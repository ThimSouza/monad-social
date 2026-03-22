/**
 * Shim até `pnpm codegen` gerar o módulo real em `generated/`.
 * Tipagem permissiva para o IDE; após codegen podes remover este ficheiro
 * se o projeto passar a resolver só a pasta gerada.
 */
declare module "generated" {
  export const Posts: any;
  export const SocialGraph: any;
  export const Interactions: any;
}
