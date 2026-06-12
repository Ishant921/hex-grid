import React from "react";
import ReactDOM from "react-dom/client";

try {
  const root = ReactDOM.createRoot(
    document.getElementById("root")
  );

  root.render("Hello");

  document.body.innerHTML += "<p>render succeeded</p>";
} catch (err) {
  document.body.innerHTML +=
    "<pre>" + err.toString() + "</pre>";
}
