export interface NavItem {
  id: string;
  /** icon key，对应组件内置 SVG 图标库 */
  icon: string;
  label: string;
  badge?: number;
}
