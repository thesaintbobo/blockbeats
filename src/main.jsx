import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BlockBeats from "./BlockBeats";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BlockBeats />
  </StrictMode>
);
