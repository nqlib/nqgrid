// becocharts was authored against echarts 5; the playground ships echarts 6.
// These deep `/lib/...` modules exist at runtime but lack bundled type
// declarations in echarts 6 — declare them so the copied source typechecks.
declare module "echarts/lib/animation/basicTransition.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const initProps: (...args: any[]) => any;
}
declare module "echarts/lib/util/graphic.js" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Rect {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}
