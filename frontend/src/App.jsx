import React from "react";
import { Routes, Route } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import CasePage from "./pages/CasePage.jsx";
import AnalysisPage from "./pages/AnalysisPage.jsx";

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cases/:caseId" element={<CasePage />} />
        <Route path="/cases/:caseId/dumps/:dumpId" element={<AnalysisPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
