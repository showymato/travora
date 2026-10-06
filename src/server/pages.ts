import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "./errors";

/** In pages: turn a service's NOT_FOUND into a real 404 (other errors still reach error.tsx). */
export async function or404<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
}
