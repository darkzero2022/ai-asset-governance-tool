#!/usr/bin/env bash
# Shared dependency detection / installation helpers for scripts/setup.sh.
# Sourced, not executed. Requires: bash 3.2+.

NODE_MIN_MAJOR=22

# --- platform / package-manager detection --------------------------------
detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

detect_pkg_manager() {
  for pm in apt-get dnf yum pacman zypper apk brew winget; do
    if command -v "$pm" >/dev/null 2>&1; then echo "$pm"; return 0; fi
  done
  echo "none"
}

have() { command -v "$1" >/dev/null 2>&1; }

node_major() {
  have node || { echo 0; return; }
  node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0
}

# Print the command a user would run by hand to install $1 on this platform.
install_hint() {
  local dep="$1" os pm
  os="$(detect_os)"; pm="$(detect_pkg_manager)"
  case "$dep" in
    node)
      case "$pm" in
        apt-get) echo "curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_MAJOR}.x | sudo -E bash - && sudo apt-get install -y nodejs" ;;
        dnf|yum) echo "curl -fsSL https://rpm.nodesource.com/setup_${NODE_MIN_MAJOR}.x | sudo bash - && sudo $pm install -y nodejs" ;;
        pacman)  echo "sudo pacman -S --noconfirm nodejs npm" ;;
        zypper)  echo "sudo zypper install -y nodejs${NODE_MIN_MAJOR}" ;;
        apk)     echo "sudo apk add nodejs npm" ;;
        brew)    echo "brew install node@${NODE_MIN_MAJOR}" ;;
        winget)  echo "winget install --id OpenJS.NodeJS.LTS   (or use scripts/setup.ps1)" ;;
        *)       echo "install Node ${NODE_MIN_MAJOR}+ from https://nodejs.org/en/download" ;;
      esac ;;
    docker)
      case "$os" in
        linux) echo "curl -fsSL https://get.docker.com | sudo sh   # then: sudo usermod -aG docker \$USER && newgrp docker" ;;
        macos) echo "brew install --cask docker   # or download Docker Desktop from https://www.docker.com/products/docker-desktop" ;;
        windows) echo "winget install --id Docker.DockerDesktop   (or use scripts/setup.ps1)" ;;
        *)     echo "install Docker Desktop from https://www.docker.com/products/docker-desktop" ;;
      esac ;;
    openssl)
      case "$pm" in
        apt-get) echo "sudo apt-get install -y openssl" ;;
        dnf|yum) echo "sudo $pm install -y openssl" ;;
        pacman)  echo "sudo pacman -S --noconfirm openssl" ;;
        zypper)  echo "sudo zypper install -y openssl" ;;
        apk)     echo "sudo apk add openssl" ;;
        brew)    echo "brew install openssl" ;;
        *)       echo "install openssl" ;;
      esac ;;
    git)
      case "$pm" in
        apt-get) echo "sudo apt-get install -y git" ;;
        dnf|yum) echo "sudo $pm install -y git" ;;
        pacman)  echo "sudo pacman -S --noconfirm git" ;;
        zypper)  echo "sudo zypper install -y git" ;;
        apk)     echo "sudo apk add git" ;;
        brew)    echo "brew install git" ;;
        *)       echo "install git" ;;
      esac ;;
  esac
}

# Run a command as root (directly if already root, else via sudo).
run_priv() {
  if [ "$(id -u 2>/dev/null || echo 0)" -eq 0 ]; then "$@"; else
    have sudo || { echo "  Need root (or sudo) to install packages." >&2; return 1; }
    sudo "$@"
  fi
}

# Attempt to install $1. Returns non-zero on failure.
try_install() {
  local dep="$1" pm
  pm="$(detect_pkg_manager)"

  echo "  Installing $dep ..." >&2
  case "$dep:$pm" in
    node:apt-get) curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN_MAJOR}.x" | run_priv -E bash - && run_priv apt-get install -y nodejs ;;
    node:dnf|node:yum) curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MIN_MAJOR}.x" | run_priv bash - && run_priv "${pm}" install -y nodejs ;;
    node:pacman) run_priv pacman -S --noconfirm nodejs npm ;;
    node:zypper) run_priv zypper install -y "nodejs${NODE_MIN_MAJOR}" ;;
    node:apk)    run_priv apk add nodejs npm ;;
    node:brew)   brew install "node@${NODE_MIN_MAJOR}" && brew link --overwrite --force "node@${NODE_MIN_MAJOR}" ;;
    node:winget) winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements ;;
    docker:apt-get|docker:dnf|docker:yum|docker:pacman|docker:zypper|docker:apk) curl -fsSL https://get.docker.com | run_priv sh ;;
    docker:brew) brew install --cask docker ;;
    docker:winget) winget install --id Docker.DockerDesktop --exact --accept-source-agreements --accept-package-agreements ;;
    openssl:apt-get) run_priv apt-get install -y openssl ;;
    openssl:dnf|openssl:yum) run_priv "${pm}" install -y openssl ;;
    openssl:pacman) run_priv pacman -S --noconfirm openssl ;;
    openssl:zypper) run_priv zypper install -y openssl ;;
    openssl:apk) run_priv apk add openssl ;;
    openssl:brew) brew install openssl ;;
    git:apt-get) run_priv apt-get install -y git ;;
    git:dnf|git:yum) run_priv "${pm}" install -y git ;;
    git:pacman) run_priv pacman -S --noconfirm git ;;
    git:zypper) run_priv zypper install -y git ;;
    git:apk) run_priv apk add git ;;
    git:brew) brew install git ;;
    git:winget) winget install --id Git.Git --exact --accept-source-agreements --accept-package-agreements ;;
    *) echo "  No automatic installer for '$dep' (package manager: $pm)." >&2; return 1 ;;
  esac
}

# rand helpers that don't hard-depend on openssl.
rand_hex32() {
  if have openssl; then openssl rand -hex 32
  elif have node; then node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'
  elif [ -r /dev/urandom ]; then head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  else date +%s | sha256sum | cut -c1-64
  fi
}
rand_password() {
  if have openssl; then openssl rand -base64 24 | tr -d '/+=' | cut -c1-24
  elif have node; then node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64").replace(/[/+=]/g,"").slice(0,24))'
  else head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24
  fi
}

# ensure_dependencies "<space-separated deps>" <auto:true|false> <yes:true|false> [install-mode label]
# deps: any of node npm openssl docker git
ensure_dependencies() {
  local deps="$1" auto="${2:-false}" yes="${3:-false}" mode_label="${4:-}"
  local missing="" too_old=""
  local pm; pm="$(detect_pkg_manager)"

  echo "Platform: $(detect_os) · package manager: ${pm}${mode_label:+ · install mode: ${mode_label}} · checking:${deps}" >&2
  if [ "$(detect_os)" = "macos" ] && [ "$pm" != "brew" ]; then
    echo "  (Homebrew not found — install it first: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\")" >&2
  fi

  for dep in $deps; do
    case "$dep" in
      node)
        if ! have node; then missing="$missing node"
        elif [ "$(node_major)" -lt "$NODE_MIN_MAJOR" ]; then too_old="$too_old node"
        fi ;;
      npm)     have npm || missing="$missing npm" ;;
      openssl) have openssl || missing="$missing openssl" ;;
      docker)  have docker || missing="$missing docker" ;;
      git)     have git || missing="$missing git" ;;
    esac
  done

  # npm ships with node — collapse a lone npm-miss into node.
  if echo "$missing" | grep -qw npm && ! echo "$missing" | grep -qw node && ! have node; then
    missing="$(echo "$missing" | sed 's/\bnpm\b/node/')"
  fi

  [ -z "$missing" ] && [ -z "$too_old" ] && return 0

  echo >&2
  [ -n "$too_old" ] && echo "Node $(node -v 2>/dev/null) is too old — this project needs Node ${NODE_MIN_MAJOR}+." >&2
  [ -n "$missing" ] && echo "Missing dependencies:$missing" >&2

  local to_install="$missing"
  echo "$too_old" | grep -qw node && to_install="$to_install node"
  to_install="$(echo "$to_install" | xargs -n1 2>/dev/null | sort -u | xargs)"

  local do_install="$auto"
  if [ "$do_install" != "true" ] && [ "$yes" != "true" ]; then
    printf 'Attempt to install them now? [y/N]: ' >&2
    local answer; read -r answer
    case "$answer" in y|Y|yes|YES) do_install="true" ;; esac
  elif [ "$yes" = "true" ]; then
    do_install="true"
  fi

  if [ "$do_install" != "true" ]; then
    echo >&2
    echo "Install them by hand, then re-run scripts/setup.sh:" >&2
    for dep in $to_install; do echo "  $dep:  $(install_hint "$dep")" >&2; done
    exit 1
  fi

  local failed=""
  for dep in $to_install; do
    if try_install "$dep"; then :; else failed="$failed $dep"; fi
  done
  hash -r 2>/dev/null || true

  # re-verify
  local still=""
  for dep in $to_install; do
    case "$dep" in
      node) { have node && [ "$(node_major)" -ge "$NODE_MIN_MAJOR" ]; } || still="$still node" ;;
      *) have "$dep" || still="$still $dep" ;;
    esac
  done
  if [ -n "$still" ]; then
    echo >&2
    echo "Still missing after install attempt:$still" >&2
    echo "Install by hand and re-run:" >&2
    for dep in $still; do echo "  $dep:  $(install_hint "$dep")" >&2; done
    [ "$(detect_os)" = "linux" ] && echo "(If you just installed Docker, log out/in or run: newgrp docker)" >&2
    exit 1
  fi
  echo "All dependencies present." >&2
  echo >&2
}
