declare module '@moeru/three-mmd' {
  export type MMD = any

  export const buildAnimation: any

  export class VMDLoader {
    constructor(manager?: any)
    load(url: string, onLoad: (object: any) => void, onProgress?: any, onError?: any): void
    loadAsync(url: string, onProgress?: any): Promise<any>
  }

  export class MMDLoader {
    constructor(plugins?: any, manager?: any)
    load(url: string, onLoad: (mmd: any) => void, onProgress?: any, onError?: any): void
    loadAsync(url: string, onProgress?: any): Promise<any>
    loadAnimation(url: string, object: any, onLoad: (animation: any) => void, onProgress?: any, onError?: any): void
    loadAnimationAsync(url: string, object: any, onProgress?: any): Promise<any>
  }
}
