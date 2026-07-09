{
  description = "notara - reproducible Nix build environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        bun = pkgs.bun;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [ bun pkgs.nodejs_22 pkgs.python3 pkgs.gcc pkgs.makeWrapper ];

          shellHook = ''
            echo "notara dev environment"
            echo "Bun: $(bun --version)"
            echo "Node: $(node --version)"
            echo ""
            echo "Run: bun install && bun run build"
          '';
        };

        packages.default = pkgs.stdenv.mkDerivation {
          name = "notara";
          src = ./.;

          nativeBuildInputs = [ bun pkgs.python3 pkgs.gcc ];

          buildPhase = ''
            runHook preBuild
            bun install --frozen-lockfile --no-cache
            bash scripts/patch-msgpackr.sh
            cd packages/shared && bun run build && cd ../..
            cd packages/server && bun run build && cd ../..
            cd packages/app && bun run build && cd ../..
            runHook postBuild
          '';

          installPhase = ''
            mkdir -p $out
            cp -r packages/server/dist $out/server-dist
            cp -r packages/app/dist $out/app-dist
            cp -r packages/server/migrations $out/migrations
            cp -r packages/shared/dist $out/shared-dist
            cp -r node_modules $out/node_modules
          '';
        };
      }
    );
}
