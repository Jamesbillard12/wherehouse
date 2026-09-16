"""Preserve Python syntax/comments while forcing vertical argument lists."""
import ast
import io
import sys
import tokenize

import black
import libcst as cst
from libcst.metadata import PositionProvider


def comma_last(items):
    if not items:
        return items
    last = items[-1]
    if isinstance(last.comma, cst.MaybeSentinel):
        last = last.with_changes(comma=cst.Comma())
    return (*items[:-1], last)


class VerticalLists(cst.CSTTransformer):
    def leave_Call(self, original, updated):
        args = updated.args
        if len(args) == 1 and isinstance(args[0].value, cst.GeneratorExp):
            value = args[0].value
            if not value.lpar:
                value = value.with_changes(lpar=(cst.LeftParen(),), rpar=(cst.RightParen(),))
                args = (args[0].with_changes(value=value),)
        return updated.with_changes(args=comma_last(args))

    def leave_FunctionDef(self, original, updated):
        params = updated.params
        if params.star_kwarg is not None:
            params = params.with_changes(star_kwarg=comma_last((params.star_kwarg,))[0])
        elif params.kwonly_params:
            params = params.with_changes(kwonly_params=comma_last(params.kwonly_params))
        elif isinstance(params.star_arg, cst.Param):
            params = params.with_changes(star_arg=comma_last((params.star_arg,))[0])
        elif params.params:
            params = params.with_changes(params=comma_last(params.params))
        elif params.posonly_params and isinstance(params.posonly_ind, cst.ParamSlash):
            params = params.with_changes(posonly_ind=params.posonly_ind.with_changes(comma=cst.Comma()))
        return updated.with_changes(params=params)

    def leave_Dict(self, original, updated):
        return updated.with_changes(elements=comma_last(updated.elements))


class VerticalLambdas(cst.CSTTransformer):
    METADATA_DEPENDENCIES = (PositionProvider,)

    def __init__(self, source):
        self.lines = source.splitlines()

    def leave_Lambda(self, original, updated):
        params = updated.params
        if not (params.params or params.posonly_params or params.kwonly_params
                or isinstance(params.star_arg, cst.Param) or params.star_kwarg):
            return updated
        line = self.lines[self.get_metadata(PositionProvider, original).start.line - 1]
        indent = len(line) - len(line.lstrip())

        def newline(extra=4, existing=None):
            last = cst.SimpleWhitespace(" " * (indent + extra))
            if isinstance(existing, cst.ParenthesizedWhitespace):
                return existing.with_changes(indent=False, last_line=last)
            return cst.ParenthesizedWhitespace(first_line=cst.TrailingWhitespace(), indent=False, last_line=last)

        class Commas(cst.CSTTransformer):
            def visit_Param(self, node):
                return False

            def leave_Param(self, original, node):
                if isinstance(node.comma, cst.Comma):
                    return node.with_changes(comma=node.comma.with_changes(whitespace_after=newline(existing=node.comma.whitespace_after)))
                return node

            leave_ParamSlash = leave_Param
            leave_ParamStar = leave_Param

        return updated.with_changes(
            lpar=updated.lpar or (cst.LeftParen(),),
            rpar=(updated.rpar[0].with_changes(whitespace_before=newline(0, updated.rpar[0].whitespace_before)), *updated.rpar[1:])
            if updated.rpar else (cst.RightParen(whitespace_before=newline(0)),),
            whitespace_after_lambda=newline(existing=updated.whitespace_after_lambda),
            params=params.visit(Commas()),
            colon=updated.colon.with_changes(whitespace_after=newline(existing=updated.colon.whitespace_after)),
        )


def format_code(source):
    tree = ast.parse(source, type_comments=True)
    expanded = cst.parse_module(source).visit(VerticalLists()).code
    result = black.format_str(expanded, mode=black.Mode(line_length=100))
    result = cst.MetadataWrapper(cst.parse_module(result)).visit(VerticalLambdas(result)).code
    def syntax(tree):
        for node in ast.walk(tree):
            if isinstance(node, ast.TypeIgnore):
                node.lineno = 0
        return ast.dump(tree)

    if syntax(tree) != syntax(ast.parse(result, type_comments=True)):
        raise ValueError("Formatting changed Python syntax; refusing the edit")

    def comments(text):
        return [t.string for t in tokenize.generate_tokens(io.StringIO(text).readline) if t.type == tokenize.COMMENT]

    if comments(source) != comments(result):
        raise ValueError("Formatting changed Python comments; refusing the edit")
    return result


if __name__ == "__main__":
    sys.stdout.write(format_code(sys.stdin.read()))
