"""Add syntax-aware trailing commas, then let Black handle layout.

The trailing commas force even short, nonempty lists to expand. LibCST retains
comments; an AST comparison prevents returning a change in program behavior.
"""

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
        elif params.posonly_params:
            slash = params.posonly_ind
            if isinstance(slash, cst.ParamSlash):
                params = params.with_changes(posonly_ind=slash.with_changes(comma=cst.Comma()))
        return updated.with_changes(params=params)

    def leave_Dict(self, original, updated):
        return updated.with_changes(elements=comma_last(updated.elements))


class VerticalLambdas(cst.CSTTransformer):
    METADATA_DEPENDENCIES = (PositionProvider,)

    def __init__(self, source):
        self.lines = source.splitlines()

    def leave_Lambda(self, original, updated):
        parameters = updated.params
        if not (parameters.params or parameters.posonly_params or parameters.kwonly_params
                or isinstance(parameters.star_arg, cst.Param) or parameters.star_kwarg):
            return updated
        line = self.lines[self.get_metadata(PositionProvider, original).start.line - 1]
        indent = len(line) - len(line.lstrip())

        def newline(extra=4, existing=None):
            if isinstance(existing, cst.ParenthesizedWhitespace):
                return existing.with_changes(indent=False, last_line=cst.SimpleWhitespace(" " * (indent + extra)))
            return cst.ParenthesizedWhitespace(
                first_line=cst.TrailingWhitespace(), indent=False,
                last_line=cst.SimpleWhitespace(" " * (indent + extra)),
            )

        class Commas(cst.CSTTransformer):
            def visit_Param(self, node):
                return False

            def leave_Param(self, original_param, param):
                if isinstance(param.comma, cst.Comma):
                    return param.with_changes(comma=param.comma.with_changes(whitespace_after=newline(existing=param.comma.whitespace_after)))
                return param

            def leave_ParamSlash(self, original_slash, slash):
                if isinstance(slash.comma, cst.Comma):
                    return slash.with_changes(comma=slash.comma.with_changes(whitespace_after=newline(existing=slash.comma.whitespace_after)))
                return slash

            def leave_ParamStar(self, original_star, star):
                return star.with_changes(comma=star.comma.with_changes(whitespace_after=newline(existing=star.comma.whitespace_after)))

        return updated.with_changes(
            lpar=updated.lpar or (cst.LeftParen(),),
            rpar=updated.rpar or (cst.RightParen(whitespace_before=newline(0)),),
            whitespace_after_lambda=newline(existing=updated.whitespace_after_lambda),
            params=parameters.visit(Commas()),
            colon=updated.colon.with_changes(whitespace_after=newline(existing=updated.colon.whitespace_after)),
        )


def format_code(source):
    tree = ast.parse(source)
    expanded = cst.parse_module(source).visit(VerticalLists()).code
    result = black.format_str(expanded, mode=black.Mode(line_length=100))
    result = cst.MetadataWrapper(cst.parse_module(result)).visit(VerticalLambdas(result)).code
    if ast.dump(tree) != ast.dump(ast.parse(result)):
        raise ValueError("Formatting changed Python's syntax tree; refusing the edit")
    def comments(text):
        return [token.string for token in tokenize.generate_tokens(io.StringIO(text).readline)
                if token.type == tokenize.COMMENT]
    if comments(source) != comments(result):
        raise ValueError("Formatting changed Python comments; refusing the edit")
    return result


if __name__ == "__main__":
    sys.stdout.write(format_code(sys.stdin.read()))
