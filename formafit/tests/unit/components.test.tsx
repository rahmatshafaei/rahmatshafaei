import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/coach/markdown";
import { MacroBar, MacroLine } from "@/components/nutrition/macro-bar";
import { ProgressRing } from "@/components/nutrition/progress-ring";
import { VerificationBadge } from "@/components/nutrition/verification-badge";
import { ThemeControl } from "@/components/layout/theme-control";
import { ChipGroup } from "@/components/ui/choice";
import { Field, Input } from "@/components/ui/input";

describe("nutrition components", () => {
  it("MacroBar shows rounded values and exposes progress semantics", () => {
    render(<MacroBar macro="protein" value={34.56} target={150} />);
    const bar = screen.getByRole("progressbar", { name: "Protein" });
    expect(bar).toHaveAttribute("aria-valuenow", "35");
    expect(bar).toHaveAttribute("aria-valuemax", "150");
    expect(screen.getByText("35")).toBeInTheDocument();
  });

  it("MacroLine flags incomplete totals", () => {
    render(<MacroLine totals={{ kcal: 159.6, protein: 34.5, carbs: 0, fat: 2.25, missing: ["fat"] }} />);
    expect(screen.getByText(/160 kcal/)).toBeInTheDocument();
    expect(screen.getByText("(ofullständig)")).toBeInTheDocument();
  });

  it("ProgressRing has an accessible label", () => {
    render(<ProgressRing value={1200} max={2000} label="1200 av 2000 kcal" />);
    expect(screen.getByRole("img", { name: "1200 av 2000 kcal" })).toBeInTheDocument();
  });

  it("labels estimated values clearly", () => {
    render(<VerificationBadge verification="estimated" />);
    expect(screen.getByText("Uppskattat")).toHaveAttribute("title", expect.stringContaining("kontrollera"));
  });
});

describe("form components", () => {
  it("Field wires errors to the control", () => {
    render(
      <Field label="Vikt" htmlFor="w" error="Ange vikt i kg.">
        <Input id="w" aria-invalid />
      </Field>,
    );
    expect(screen.getByLabelText("Vikt")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Ange vikt i kg.");
  });

  it("ChipGroup toggles values with aria-pressed", async () => {
    function Harness() {
      const [values, setValues] = useState<string[]>([]);
      return <ChipGroup label="Allergier" values={values} onChange={setValues} options={[{ value: "milk", label: "Mjölkprotein" }, { value: "egg", label: "Ägg" }]} />;
    }
    render(<Harness />);
    const egg = screen.getByRole("button", { name: "Ägg" });
    expect(egg).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(egg);
    expect(egg).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(egg);
    expect(egg).toHaveAttribute("aria-pressed", "false");
  });
});

describe("coach markdown", () => {
  it("renders lists and bold text", () => {
    render(<Markdown text={"**Tips:**\n- Ät protein\n- Sov 8 timmar\n1. Först\n2. Sedan"} />);
    expect(screen.getByText("Tips:").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("never renders HTML from the model", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<img");
  });
});

describe("theme control", () => {
  it("applies and remembers an explicit theme, and System clears it", async () => {
    localStorage.clear();
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Mörkt" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("formafit:theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Mörkt" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "System" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("formafit:theme")).toBeNull();
  });
});
