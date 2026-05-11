{
  description = "notion-alt - reproducible Nix build environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        bun = pkgs.bun;

        # Build the app with Bun inside Nix
        notion-alt-build = pkgs.stdenv.mkDerivation {
          name = "notion-alt-build";
          src = ./.;

          nativeBuildInputs = [ bun pkgs.python3 ];

          # Bun needs node_modules to exist for workspace resolution
          buildPhase = ''
            runHook preBuild
            
            # Install deps - Bun resolves from bun.lock
            HOME=$TMPDIR bun install --frozen-lockfile --no-cache
            
            # Build all packages
            cd packages/shared && bun run build && cd ../..
            cd packages/server && bun run build && cd ../..
            cd packages/app && bun run build && cd ../..
            
            runHook postBuild
          '';

          installPhase = ''
            mkdir -p $out/app
            
            # Copy built artifacts
            cp -r packages/server/dist $out/app/server-dist
            cp -r packages/app/dist $out/app/app-dist
            cp -r packages/server/migrations $out/app/migrations
            cp -r packages/shared/dist $out/app/shared-dist
            
            # Copy package.json files for workspace resolution
            cp package.json $out/app/
            cp packages/shared/package.json $out/app/shared-package.json
            cp packages/server/package.json $out/app/server-package.json
            cp packages/app/package.json $out/app/app-package.json
            
            # Copy all node_modules (needed for runtime)
            cp -r node_modules $out/app/node_modules
            cp -r packages/shared/node_modules $out/app/shared-node_modules || true
            cp -r packages/server/node_modules $out/app/server-node_modules || true
            cp -r packages/app/node_modules $out/app/app-node_modules || true
            
            # Copy the bun binary
            cp ${bun}/bin/bun $out/app/bun
          '';
        };

        # Docker image built entirely by Nix
        notion-alt-image = pkgs.dockerTools.buildImage {
          name = "notion-alt";
          tag = "latest";
          
          copyToRoot = pkgs.buildEnv {
            name = "image-root";
            paths = [ 
              bun
              pkgs.coreutils
              pkgs.cacert
            ];
            pathsToLink = [ "/bin" ];
          };

          config = {
            Cmd = [ "bun" "run" "/app/packages/server/dist/index.js" ];
            WorkingDir = "/app";
            ExposedPorts = { "3000/tcp" = {}; };
            Env = [
              "NODE_ENV=production"
              "DATA_DIR=/data"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
            ];
          };

          # Copy the build output into the image
          extraCommands = ''
            mkdir -p app/data
            # Copy build artifacts
            cp -r ${notion-alt-build}/app/* app/
            # Restore workspace structure
            mkdir -p app/packages/shared/dist
            mkdir -p app/packages/server/dist
            mkdir -p app/packages/app/dist
            mkdir -p app/packages/server/migrations
            mv app/shared-dist/* app/packages/shared/dist/ 2>/dev/null || true
            mv app/server-dist/* app/packages/server/dist/ 2>/dev/null || true
            mv app/app-dist/* app/packages/app/dist/ 2>/dev/null || true
            mv app/migrations/* app/packages/server/migrations/ 2>/dev/null || true
            mv app/shared-package.json app/packages/shared/package.json
            mv app/server-package.json app/packages/server/package.json
            mv app/app-package.json app/packages/app/package.json
            mv app/shared-node_modules app/packages/shared/node_modules 2>/dev/null || true
            mv app/server-node_modules app/packages/server/node_modules 2>/dev/null || true
            mv app/app-node_modules app/packages/app/node_modules 2>/dev/null || true
          '';
        };

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [ bun pkgs.nodejs_22 pkgs.python3 ];
          shellHook = ''
            echo "notion-alt dev environment"
            echo "Bun: $(bun --version)"
            echo "Node: $(node --version)"
          '';
        };

        packages.default = notion-alt-build;
        packages.docker-image = notion-alt-image;
      }
    );
}
