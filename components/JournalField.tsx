"use client";

import { useEffect, useRef } from "react";

type Props = {
  text: string;
  phase: "field" | "released";
  onTextChange: (text: string) => void;
  onSubmit: () => void;
};

export function JournalField({ text, phase, onTextChange, onSubmit }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase === "field") taRef.current?.focus();
  }, [phase]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const focusField = () => taRef.current?.focus();

  return (
    <div className="w-full max-w-md mx-auto relative">
      <div
        className={`transition-opacity duration-700 ease-out ${
          phase === "field" ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className="cursor-text text-center"
          onClick={focusField}
        >
          <p className="text-bone/80 text-xl sm:text-[22px] leading-snug select-none">
            what do you want to let go of?
          </p>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            maxLength={280}
            disabled={phase !== "field"}
            aria-label="what do you want to let go of?"
            className="block w-full h-10 mt-4 bg-transparent resize-none outline-none border-0 p-0 text-center"
            style={{
              color: "transparent",
              caretColor: "transparent",
              WebkitTextFillColor: "transparent",
              font: "inherit",
            }}
          />
        </div>
        <div className="flex justify-center mt-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!text.trim() || phase !== "field"}
            className="text-xl sm:text-2xl text-royal hover:opacity-80 transition-opacity disabled:text-bone/25 disabled:cursor-default"
          >
            release ↵
          </button>
        </div>
      </div>
    </div>
  );
}
