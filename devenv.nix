{
  pkgs,
  config,
  ...
}:

let
  # Everything the shell caches or downloads lands here instead of $HOME, so
  # entering the environment writes nothing outside the checkout. .devenv/ is
  # gitignored and safe to delete; it rebuilds on the next `devenv shell`.
  stateDir = "${config.devenv.root}/.devenv/state";
in
{
  packages = with pkgs; [
    bun # 1.4.2 — the runtime AND package manager for every package here

    # The npm linux-x64 biome is a dynamically linked ELF that a NixOS host
    # refuses to start without nix-ld. BIOME_BINARY (env below) points the npm
    # wrapper at this one, so every `bunx @biomejs/biome` gate works unchanged.
    # CI runs the package.json version: keep both on the same minor.
    biome
    nodejs_22 # scripts/bundle-server.sh and electron tooling shell out to `node`
    python3 # node-gyp fallback for native deps (better-sqlite3, msgpackr)
    gnumake
    gcc
    pkg-config
    openssl # `openssl rand -hex 32` for BETTER_AUTH_SECRET
    git
    ripgrep
    jq
    gzip # scripts/check-bundle-size.sh
    cacert
  ];

  env = {
    # Containment: no writes to $HOME. BUN_INSTALL also redirects global
    # installs and the `bunx` cache into the project.
    BUN_INSTALL = "${stateDir}/bun";
    BUN_INSTALL_CACHE_DIR = "${stateDir}/bun-cache";
    BUN_TMPDIR = "${stateDir}/tmp";
    npm_config_cache = "${stateDir}/npm-cache";
    XDG_CACHE_HOME = "${stateDir}/xdg-cache";

    # SQLite databases and uploads stay in the checkout, never in $HOME.
    DATA_DIR = "${config.devenv.root}/.data";

    BIOME_BINARY = "${pkgs.biome}/bin/biome";
  };

  enterShell = ''
    mkdir -p "$BUN_INSTALL_CACHE_DIR" "$BUN_TMPDIR" "$npm_config_cache" \
             "$XDG_CACHE_HOME" "$DATA_DIR"
    echo "notara — bun $(bun --version) / node $(node --version)"

    # package.json declares a pre-commit and a pre-push gate, but nothing installs
    # them into .git/hooks: they only appear once `bootstrap` runs. A checkout
    # that skipped it commits with no gate at all, and nothing says so. Install
    # on entry — once, and loudly if it fails.
    if [ ! -f "${config.devenv.root}/.git/hooks/pre-commit" ]; then
      if (cd "${config.devenv.root}" && bunx simple-git-hooks) >/dev/null 2>&1; then
        echo "notara — git hooks installed"
      else
        echo "notara — WARNING: git hooks NOT installed; commits run no gate" >&2
      fi
    fi
  '';

  scripts = {
    # Replaces the implicit postinstall the repo refuses to have. Run once
    # after a fresh clone (CONTRIBUTING.md) or after a dependency bump.
    bootstrap.exec = ''
      bun install --ignore-scripts
      bun run apply-patches
      bunx simple-git-hooks
    '';

    # The same gate CI runs, minus the docker builds.
    check.exec = "bun run pre-merge";
  };
}
