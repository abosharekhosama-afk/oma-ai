export class RenderedPageFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RenderedPageFetchError';
  }
}
