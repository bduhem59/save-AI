"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { SavesList } from "@/components/SavesList";
import { Categories } from "@/components/Categories";
import { Stats } from "@/components/Stats";

type Tab = "saves" | "categories" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "saves",      label: "Saves" },
  { id: "categories", label: "Catégories" },
  { id: "stats",      label: "Statistiques" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("saves");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q) setActiveTab("saves");
  }, []);

  const handleCategoryClick = useCallback((category: string) => {
    setFilterCategory(category);
    setFilterSource("");
    setActiveTab("saves");
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== "saves") {
      setSearchQuery("");
      setFilterCategory("");
      setFilterSource("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-0 mb-6 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={[
                "px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "saves" && (
          <SavesList
            searchQuery={searchQuery}
            filterSource={filterSource}
            filterCategory={filterCategory}
          />
        )}
        {activeTab === "categories" && (
          <Categories onCategoryClick={handleCategoryClick} />
        )}
        {activeTab === "stats" && <Stats />}
      </main>
    </div>
  );
}
