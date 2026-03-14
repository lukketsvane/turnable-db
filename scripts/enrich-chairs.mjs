#!/usr/bin/env node
/**
 * Enrich chairs.json with data from stolar-db/noreg sources:
 * - nasjonalmuseet_stoler_128.json (full museum metadata)
 * - weight_estimates.json (estimated weights)
 */

import { readFileSync, writeFileSync } from "fs"
import { resolve } from "path"

const STOLAR_DB = "C:/Users/Shadow/Documents/GitHub/stolar-db/noreg"
const CHAIRS_PATH = resolve("public/data/chairs.json")

// Load sources
const chairs = JSON.parse(readFileSync(CHAIRS_PATH, "utf-8"))
const museumData = JSON.parse(readFileSync(resolve(STOLAR_DB, "nasjonalmuseet_stoler_128.json"), "utf-8"))
const weightData = JSON.parse(readFileSync(resolve(STOLAR_DB, "weight_estimates.json"), "utf-8"))

// Index by objectId
const museumIndex = Object.fromEntries(museumData.map(d => [d.objectId, d]))
const weightIndex = Object.fromEntries(weightData.chairs.map(d => [d.objectId, d]))

let enriched = 0

for (const chair of chairs) {
  const id = chair.id
  const museum = museumIndex[id]
  const weight = weightIndex[id]

  if (museum) {
    // Add new fields from museum data
    chair.betegnelse = museum.Betegnelse || ""
    chair.stilperiode = museum.Stilperiode || ""
    chair.dekorteknikk = Array.isArray(museum.Dekorteknikk) ? museum.Dekorteknikk.join(", ") : (museum.Dekorteknikk || "")
    chair.emneord = Array.isArray(museum.Emneord) ? museum.Emneord.join(", ") : (museum.Emneord || "")
    chair.eier = museum["Eier og samling"] || ""

    // Use richer description if current text is just materials
    if (museum["Materiale og teknikk"] && museum["Materiale og teknikk"].length > (chair.text || "").length) {
      chair.text = museum["Materiale og teknikk"]
    }

    // Fill in acquisition if empty
    if (!chair.acquisition && museum.Ervervelse) {
      chair.acquisition = museum.Ervervelse
    }

    enriched++
  }

  if (weight) {
    chair.estimatedWeight = weight.estimatedWeight_kg ? `${weight.estimatedWeight_kg} kg` : ""
    chair.primaryMaterial = weight.primaryMaterial || ""
  }
}

writeFileSync(CHAIRS_PATH, JSON.stringify(chairs, null, 2), "utf-8")
console.log(`Enriched ${enriched}/${chairs.length} chairs with museum data`)
