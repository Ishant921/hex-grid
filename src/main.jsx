import ReactDOM from "react-dom/client";

try {
  const root = document.getElementById("root");

  ReactDOM.createRoot(root);

  document.body.innerHTML += "<p>createRoot succeeded</p>";
} catch (err) {
  document.body.innerHTML +=
    "<pre>" + err.toString() + "</pre>";
}
