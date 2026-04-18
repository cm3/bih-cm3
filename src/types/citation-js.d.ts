declare module 'citation-js' {
  export default class Cite {
    constructor(data?: unknown, options?: unknown);
    format(name: string, options?: unknown): unknown;
    static async(data: unknown, options?: unknown): Promise<Cite>;
  }
}
