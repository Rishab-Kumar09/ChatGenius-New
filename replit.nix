{
  description = "Node.js environment for ChatGenius";
  deps = [
    pkgs.nodejs-18_x
    pkgs.nodePackages.typescript
    pkgs.nodePackages.yarn
    pkgs.replitPackages.jest
  ];
}
