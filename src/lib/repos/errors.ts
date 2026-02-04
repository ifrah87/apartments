export class RepoError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "RepoError";
    this.status = status;
  }
}

export function badRequest(message: string) {
  return new RepoError(message, 400);
}

export function notFound(message: string) {
  return new RepoError(message, 404);
}
