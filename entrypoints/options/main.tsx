import ReactDOM from "react-dom/client";
import { applyTheme } from "@/utils/theme";
import App from "./App";
import "./style.css";

applyTheme();
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
