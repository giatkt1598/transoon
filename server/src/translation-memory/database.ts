import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import { appConfig } from "../config/app-config";
import { Log } from "../logger";
import { translationMemorySchemaSql } from "./schema";

let translationMemoryDatabase: DatabaseSync | null = null;

export function initializeTranslationMemoryDatabase() {
  if (translationMemoryDatabase) {
    return translationMemoryDatabase;
  }

  const databasePath = path.resolve(
    process.cwd(),
    appConfig.translationMemoryDatabasePath,
  );

  mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA synchronous = NORMAL;");
  database.exec(translationMemorySchemaSql);

  translationMemoryDatabase = database;

  void Log.information(
    "Initialized translation memory database at {databasePath}",
    {
      databasePath,
    },
  );

  return database;
}

export function getTranslationMemoryDatabase() {
  if (!translationMemoryDatabase) {
    throw new Error("Translation memory database has not been initialized.");
  }

  return translationMemoryDatabase;
}
