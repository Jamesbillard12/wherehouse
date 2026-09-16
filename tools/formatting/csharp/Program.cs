using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Formatting;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Formatting;

var source = await Console.In.ReadToEndAsync();
var parseOptions = new CSharpParseOptions(LanguageVersion.Preview);
var root = CSharpSyntaxTree.ParseText(source, parseOptions).GetRoot();
if (root.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error))
{
    Console.Error.WriteLine("C# contains syntax errors; formatting was not applied.");
    return 1;
}
using var workspace = new AdhocWorkspace();
root = new ParenthesizeLambdas().Visit(root)!;
var options = workspace.Options
    .WithChangedOption(FormattingOptions.UseTabs, LanguageNames.CSharp, false)
    .WithChangedOption(FormattingOptions.IndentationSize, LanguageNames.CSharp, 4)
    .WithChangedOption(FormattingOptions.TabSize, LanguageNames.CSharp, 4)
    .WithChangedOption(FormattingOptions.NewLine, LanguageNames.CSharp, "\n")
    .WithChangedOption(CSharpFormattingOptions.WrappingKeepStatementsOnSingleLine, false)
    .WithChangedOption(CSharpFormattingOptions.WrappingPreserveSingleLine, false);
var baseline = Formatter.Format(root, workspace, options);
var expanded = new VerticalLists().Visit(baseline)!;
var formatted = Formatter.Format(expanded, workspace, options).ToFullString();
// Roslyn shifts lambda blocks as a unit. Reapply list indentation after that
// shift so nested arguments do not receive the block offset twice.
var laidOut = CSharpSyntaxTree.ParseText(formatted, parseOptions).GetRoot();
var result = new VerticalLists().Visit(laidOut)!.ToFullString().TrimEnd() + "\n";
var reparsed = CSharpSyntaxTree.ParseText(result, parseOptions).GetRoot();
if (reparsed.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error) ||
    !root.DescendantTokens().Select(t => (t.RawKind, t.Text)).SequenceEqual(
        reparsed.DescendantTokens().Select(t => (t.RawKind, t.Text))))
{
    Console.Error.WriteLine("Formatting changed C# tokens; refusing the edit.");
    return 1;
}
Console.Write(result);
return 0;

sealed class ParenthesizeLambdas : CSharpSyntaxRewriter
{
    public override SyntaxNode? VisitSimpleLambdaExpression(SimpleLambdaExpressionSyntax node)
    {
        var n = (SimpleLambdaExpressionSyntax)base.VisitSimpleLambdaExpression(node)!;
        return SyntaxFactory.ParenthesizedLambdaExpression()
            .WithParameterList(SyntaxFactory.ParameterList(SyntaxFactory.SingletonSeparatedList(n.Parameter.WithoutLeadingTrivia())))
            .WithModifiers(n.Modifiers).WithArrowToken(n.ArrowToken)
            .WithBlock(n.Block).WithExpressionBody(n.ExpressionBody).WithLeadingTrivia(n.GetLeadingTrivia());
    }
}

sealed class VerticalLists : CSharpSyntaxRewriter
{
    private static int Depth(SyntaxNode node) => node.Ancestors().Count(n => n is BlockSyntax or BaseTypeDeclarationSyntax
        or NamespaceDeclarationSyntax or AccessorListSyntax or SwitchSectionSyntax
        or ArgumentListSyntax or ParameterListSyntax or InitializerExpressionSyntax
        or AnonymousObjectCreationExpressionSyntax);

    private static SyntaxToken Indent(SyntaxToken token, int depth)
    {
        var trivia = token.LeadingTrivia.ToList();
        while (trivia.Count > 0 && trivia[^1].IsKind(SyntaxKind.WhitespaceTrivia)) trivia.RemoveAt(trivia.Count - 1);
        trivia.Add(SyntaxFactory.Whitespace(new string(' ', depth * 4)));
        return token.WithLeadingTrivia(trivia);
    }

    public override SyntaxNode? VisitBlock(BlockSyntax node)
    {
        var n = (BlockSyntax)base.VisitBlock(node)!;
        return n.WithOpenBraceToken(Indent(n.OpenBraceToken, Depth(node))).WithCloseBraceToken(Indent(n.CloseBraceToken, Depth(node)));
    }

    private static T Expand<T>(T node, SyntaxNode original, SyntaxToken open, SyntaxToken close, IEnumerable<SyntaxToken> separators)
        where T : SyntaxNode
    {
        int depth = Depth(original);
        var boundaries = separators.Prepend(open).ToArray();
        var starts = boundaries.Select(t => t.GetNextToken()).ToHashSet();
        var breaks = boundaries.ToHashSet();
        return node.ReplaceTokens(breaks.Concat(starts).Append(close).Distinct(), (old, rewritten) =>
        {
            if (breaks.Contains(old) && !old.TrailingTrivia.Any(t => t.IsKind(SyntaxKind.EndOfLineTrivia)) &&
                !old.GetNextToken().LeadingTrivia.Any(t => t.IsKind(SyntaxKind.EndOfLineTrivia)))
                rewritten = rewritten.WithTrailingTrivia(rewritten.TrailingTrivia.Add(SyntaxFactory.EndOfLine("\n")));
            if (starts.Contains(old) || old == close)
            {
                if (old == close && !old.LeadingTrivia.Any(t => t.IsKind(SyntaxKind.EndOfLineTrivia)) &&
                    !old.GetPreviousToken().TrailingTrivia.Any(t => t.IsKind(SyntaxKind.EndOfLineTrivia)))
                    rewritten = rewritten.WithLeadingTrivia(SyntaxFactory.TriviaList(SyntaxFactory.EndOfLine("\n")).AddRange(rewritten.LeadingTrivia));
                rewritten = Indent(rewritten, depth + (old == close ? 0 : 1));
            }
            return rewritten;
        });
    }

    public override SyntaxNode? VisitArgumentList(ArgumentListSyntax node)
    {
        var n = (ArgumentListSyntax)base.VisitArgumentList(node)!;
        return n.Arguments.Count == 0 ? n : Expand(n, node, n.OpenParenToken, n.CloseParenToken, n.Arguments.GetSeparators());
    }
    public override SyntaxNode? VisitParameterList(ParameterListSyntax node)
    {
        var n = (ParameterListSyntax)base.VisitParameterList(node)!;
        return n.Parameters.Count == 0 ? n : Expand(n, node, n.OpenParenToken, n.CloseParenToken, n.Parameters.GetSeparators());
    }
    public override SyntaxNode? VisitInitializerExpression(InitializerExpressionSyntax node)
    {
        var n = (InitializerExpressionSyntax)base.VisitInitializerExpression(node)!;
        return n.Expressions.Count == 0 ? n : Expand(n, node, n.OpenBraceToken, n.CloseBraceToken, n.Expressions.GetSeparators());
    }
    public override SyntaxNode? VisitAnonymousObjectCreationExpression(AnonymousObjectCreationExpressionSyntax node)
    {
        var n = (AnonymousObjectCreationExpressionSyntax)base.VisitAnonymousObjectCreationExpression(node)!;
        return n.Initializers.Count == 0 ? n : Expand(n, node, n.OpenBraceToken, n.CloseBraceToken, n.Initializers.GetSeparators());
    }
}
