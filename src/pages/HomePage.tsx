import { useState } from "react";
import { Hero } from "@/components/Hero";
import { NumberList } from "@/components/NumberList";
import { SpainPrivateNumbers } from "@/components/SpainPrivateNumbers";
import { WhyChooseUs } from "@/components/WhyChooseUs";
import { FAQ } from "@/components/FAQ";
import { SmsModal } from "@/components/SmsModal";
import { usePhoneNumbers } from "@/hooks/usePhoneNumbers";
import type { PhoneNumber } from "@/types";

export function HomePage() {
  const { numbers, loading } = usePhoneNumbers();
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);

  const freeNumbers = numbers.filter((n) => n.type === "free");

  return (
    <>
      <Hero />
      <NumberList
        numbers={freeNumbers}
        type="free"
        loading={loading}
        onViewSms={setSelectedPhone}
      />
      <SpainPrivateNumbers />
      <WhyChooseUs />
      <FAQ />
      <SmsModal phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
    </>
  );
}

export function FreeNumbersPage() {
  const { numbers, loading } = usePhoneNumbers();
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const freeNumbers = numbers.filter((n) => n.type === "free");

  return (
    <div className="w-full max-w-full overflow-hidden pt-16 sm:pt-20">
      <NumberList
        numbers={freeNumbers}
        type="free"
        loading={loading}
        onViewSms={setSelectedPhone}
      />
      <SmsModal phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
    </div>
  );
}

export function PaidNumbersPage() {
  const { numbers, loading } = usePhoneNumbers();
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const paidNumbers = numbers.filter((n) => n.type === "paid");

  return (
    <div className="w-full max-w-full overflow-hidden pt-16 sm:pt-20">
      <NumberList
        numbers={paidNumbers}
        type="paid"
        loading={loading}
        onViewSms={setSelectedPhone}
      />
      <SmsModal phone={selectedPhone} onClose={() => setSelectedPhone(null)} />
    </div>
  );
}
