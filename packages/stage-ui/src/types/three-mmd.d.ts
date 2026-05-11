declare module '@moeru/three-mmd' {
  export type MMD = any
  export const buildAnimation: any
  export const VMDLoader: any
  export class MMDLoader {
    constructor(paths: string[], manager?: any)
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<any>
  }
}
