// The @styloviz/icons/core entry point: the icon machinery without any glyph. The package
// barrel (src/public-api.ts) re-exports it.
export * from './icon.types';
export { SvIconBase } from './icon-base.directive';
export { SvIconSvgComponent } from './icon-svg.component';
export { SvIconComponent } from './sv-icon.component';
export { provideSvIcons, registerSvIcons, SvIconRegistry, type IconRegistry, type SvIconDef } from './provide-icons';
export { svWarnUnregisteredIcon } from './sv-icon.component';
export type { IconName } from './icon-names';
