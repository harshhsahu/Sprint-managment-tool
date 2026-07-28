"use client";

import { Provider } from "react-redux";
import { store } from "./store";

/** Wraps the app in the Redux store. Rendered once at the root layout. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
