"use client";

import { useEffect, useState } from "react";
import { loadPersonas, loadSelectedPersonaId } from "@/lib/personas";

export function PersonaTemplateText({
  text,
  fallback,
  className
}: {
  text?: string;
  fallback?: string;
  className?: string;
}) {
  const [personaName, setPersonaName] = useState("대표 페르소나");

  useEffect(() => {
    const personas = loadPersonas();
    const selectedId = loadSelectedPersonaId();
    const selected = personas.find((persona) => persona.id === selectedId) ?? personas[0];
    setPersonaName(selected?.name?.trim() || "대표 페르소나");
  }, []);

  return <p className={className}>{renderTemplate(text || fallback || "", personaName)}</p>;
}

function renderTemplate(text: string, personaName: string) {
  return text
    .replaceAll("{{protagonistName}}", personaName)
    .replaceAll("{{playerName}}", personaName)
    .replaceAll("{{personaName}}", personaName);
}
