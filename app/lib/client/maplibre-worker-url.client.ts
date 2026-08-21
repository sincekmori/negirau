// The .client suffix makes the react-router vite plugin stub this module out
// of the server build — ?worker&url emits its worker chunk at transform time
// (before treeshaking), so an SSR guard alone cannot keep the 460 KB chunk
// out of the Worker upload. Plain ?url would not work either: it emits the
// file verbatim, without its maplibre-gl-shared.mjs sibling import.
export { default as workerUrl } from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
