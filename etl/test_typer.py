#!/usr/bin/env python3
"""Test minimal pour isoler l'erreur Typer."""

import typer

app = typer.Typer()

@app.command()
def test1(
    path: str = typer.Option(
        default="/data/test.txt",
        help="Chemin du fichier"
    )
):
    """Test command 1."""
    print(f"Path: {path}")

@app.command()
def test2(
    value: float = typer.Option(
        default=2_000_000.0,
        help="Valeur numérique"
    ),
    flag: bool = typer.Option(
        default=True,
        help="Un booléen"
    )
):
    """Test command 2."""
    print(f"Value: {value}, Flag: {flag}")

if __name__ == "__main__":
    app()
