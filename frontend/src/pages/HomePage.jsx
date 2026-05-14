import React, { useState } from "react";

import CaseCreate from "../components/CaseCreate.jsx";
import CaseList from "../components/CaseList.jsx";

const HomePage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Casos</h1>
          <p className="text-sm text-muted">
            Gestiona tus investigaciones y volcados de memoria.
          </p>
        </div>
        <CaseCreate onCreated={() => setRefreshKey((prev) => prev + 1)} />
      </div>
      <CaseList key={refreshKey} onDeleted={() => setRefreshKey((prev) => prev + 1)} />
    </div>
  );
};

export default HomePage;
