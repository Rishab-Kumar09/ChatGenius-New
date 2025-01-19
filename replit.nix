{ pkgs }: {
  description = "Node.js environment for ChatGenius";
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
    pkgs.esbuild
    pkgs.python39
    pkgs.sqlite
  ];
  env = {
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.sqlite.out
    ];
  };
}
