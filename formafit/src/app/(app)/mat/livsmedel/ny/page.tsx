import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/feedback";
import { FoodForm } from "../food-form";

export const metadata: Metadata = { title: "Nytt livsmedel" };

export default function NewFoodPage() {
  return (
    <>
      <PageHeader title="Nytt livsmedel" description="Egna livsmedel är bara synliga för dig." />
      <Card>
        <CardContent className="pt-5">
          <FoodForm />
        </CardContent>
      </Card>
    </>
  );
}
