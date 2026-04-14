import type { DataMigration } from "../types";
import { precheck } from "./precheck";
import { stage } from "./stage";
import { finalize } from "./finalize";

export const videosToSeriesModelV1: DataMigration = {
  name: "videos_to_series_model_v1",
  description:
    "Migrate video scenes and scene folders into the typed series / season / episode / movie model.",
  precheck,
  stage,
  finalize,
};
