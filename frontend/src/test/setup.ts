import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered components between tests so repeated renders of the same
// component don't collide in the DOM.
afterEach(cleanup);
