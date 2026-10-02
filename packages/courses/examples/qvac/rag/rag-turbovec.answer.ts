import { createVectorIndex, embed, loadModel, loadVectorIndex, unloadModel, GTE_LARGE_FP16, VectorIndexStorage } from "@qvac/sdk";

const query = process.argv[2] || "Which moon has methane rain and lakes?";
console.log(`▸ Query: "${query}"`);

const documents = new Map<string, string>([
  ["1", "Saturn moon Titan has lakes, clouds, and rain made of liquid methane."],
  ["2", "Solar panels convert sunlight into electricity using photovoltaic cells."],
  ["3", "Honeybees communicate the location of flowers through a waggle dance."],
  ["4", "The Pacific Ocean is the largest and deepest ocean on Earth."],
]);
const ids = [...documents.keys()];
const texts = [...documents.values()];

const modelId = await loadModel({ modelSrc: GTE_LARGE_FP16 });

const { embedding: vectors } = await embed({ modelId, text: texts });
const index = await createVectorIndex({
  dim: vectors[0]!.length,
  storage: VectorIndexStorage.TURBOVEC_Q4,
});
await index.add({ ids, vectors });
console.log(`▸ Indexed ${index.length} vectors of dimension ${index.dim}`);

const { embedding: queryVector } = await embed({ modelId, text: query });
const hits = await index.search({ query: queryVector, k: 2 });
for (const hit of hits) {
  console.log(`▸ ${hit.score.toFixed(4)} ${documents.get(hit.id)}`);
}

const { path } = await index.write({ path: "indexes/rag-turbovec.qvi" });
await index.dispose();
console.log(`▸ Snapshot written to ${path}`);

const reloaded = await loadVectorIndex({ path });
const [best] = await reloaded.search({ query: queryVector, k: 1 });
if (best) console.log(`▸ Reloaded best match: ${documents.get(best.id)}`);
await reloaded.dispose();

await unloadModel({ modelId });
