import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme } from "@/utils/theme";
import "./style.css";

applyTheme();
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
