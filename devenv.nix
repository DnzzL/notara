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
  };

  enterShell = ''
    mkdir -p "$BUN_INSTALL_CACHE_DIR" "$BUN_TMPDIR" "$npm_config_cache" \
             "$XDG_CACHE_HOME" "$DATA_DIR"
    echo "notara — bun $(bun --version) / node $(node --version)"
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
