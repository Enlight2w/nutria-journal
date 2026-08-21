import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { MapView } from "@/components/Map";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { calculateTargets, type NutritionProfile, type NutritionTargets } from "@shared/nutrition";
import { getMealSuggestions, supplementGuides, type MealSuggestion } from "@shared/recommendations";
import { Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, Check, ChevronRight, CircleHelp, Droplets, Dumbbell, Flame, Leaf, MapPin, Menu, Minus, Plus, Sparkles, Target, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type View = "today" | "plan" | "coach" | "stores" | "progress" | "membership";
type FoodLog = { calories: number; protein: number; carbs: number; fats: number };
type StoreResult = { name: string; address: string; rating?: number; userRatingsTotal?: number; location: google.maps.LatLng | null };

const defaultProfile: NutritionProfile = {
  age: 30,
  gender: "female",
  weightKg: 64,
  heightCm: 168,
  goal: "maintain",
  activityLevel: "moderate",
  dietaryPreference: "flexitarian",
  workoutRoutine: "Three strength sessions, two long walks",
};

const navigation: { id: View; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "plan", label: "Food plan" },
  { id: "coach", label: "Coach" },
  { id: "stores", label: "Find stores" },
  { id: "progress", label: "Progress" },
];

function metricPercent(value: number, target: number) {
  return Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
}

function GoalCopy({ goal }: { goal: NutritionProfile["goal"] }) {
  const copy = {
    "fat-loss": "A measured energy gap with steady protein and fibre.",
    maintain: "A calm, consistent rhythm that sustains your energy.",
    "muscle-gain": "A gentle surplus that makes recovery part of the plan.",
    performance: "Fuel shaped around the training you want to do well.",
  }[goal];
  return <p className="text-sm text-[#515151]">{copy}</p>;
}

function StoreFinder() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [stores, setStores] = useState<StoreResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [place, setPlace] = useState("New York, NY");
  const centerRef = useRef<google.maps.LatLngLiteral>({ lat: 40.7128, lng: -74.006 });
  const markerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const directionsRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const clearMarkers = () => {
    markerRefs.current.forEach(marker => (marker.map = null));
    markerRefs.current = [];
  };

  const findStores = (activeMap = map, center = centerRef.current) => {
    if (!activeMap || !window.google?.maps?.places) return;
    setIsSearching(true);
    clearMarkers();
    const service = new google.maps.places.PlacesService(activeMap);
    service.nearbySearch({ location: center, radius: 6000, keyword: "health food grocery supplements" }, (results, status) => {
      setIsSearching(false);
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        setStores([]);
        return;
      }
      const normalized = results.slice(0, 5).map(result => ({
        name: result.name ?? "Store",
        address: result.vicinity ?? "Address available in maps",
        rating: result.rating,
        userRatingsTotal: result.user_ratings_total,
        location: result.geometry?.location ?? null,
      }));
      setStores(normalized);
      markerRefs.current = normalized.filter(item => item.location).map(item => new google.maps.marker.AdvancedMarkerElement({
        map: activeMap,
        position: item.location!,
        title: item.name,
      }));
    });
  };

  const searchPlace = () => {
    if (!map) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: place }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        toast.error("We couldn’t find that location. Try a city or postcode.");
        return;
      }
      const nextCenter = results[0].geometry.location.toJSON();
      centerRef.current = nextCenter;
      map.panTo(nextCenter);
      map.setZoom(13);
      findStores(map, nextCenter);
    });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation || !map) return toast.error("Location services are not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      position => {
        const nextCenter = { lat: position.coords.latitude, lng: position.coords.longitude };
        centerRef.current = nextCenter;
        map.panTo(nextCenter);
        map.setZoom(13);
        findStores(map, nextCenter);
      },
      () => toast.error("Location access was not granted. You can search by city instead.")
    );
  };

  const showDirections = (store: StoreResult) => {
    if (!map || !store.location) return;
    directionsRef.current ??= new google.maps.DirectionsRenderer({ map });
    const directionsService = new google.maps.DirectionsService();
    directionsService.route({ origin: centerRef.current, destination: store.location, travelMode: google.maps.TravelMode.DRIVING }, (result, status) => {
      if (status === "OK" && result) directionsRef.current?.setDirections(result);
      else toast.error("Directions aren’t available for this route yet.");
    });
  };

  return (
    <section className="smooth-enter grid gap-6 xl:grid-cols-[.9fr_1.35fr]">
      <div className="journal-card p-6 md:p-8">
        <div className="flex items-center gap-3 text-[#b05a36]"><MapPin className="size-5" /><span className="tiny-label">Local pantry</span></div>
        <h1 className="mt-4 text-4xl leading-[.95]">Find the ingredients that make your plan easier.</h1>
        <p className="mt-4 max-w-md text-[#515151]">Search for nearby markets, health-food shops, and supplement retailers. Live place details and routes come from Google Maps.</p>
        <div className="mt-7 space-y-3">
          <label className="tiny-label block text-[#515151]">Starting location</label>
          <div className="flex gap-2 rounded-full border border-[#d1c9bf] bg-[#fef9ef] p-1.5">
            <input value={place} onChange={event => setPlace(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" aria-label="Search location" />
            <button onClick={searchPlace} className="terracotta-button px-4 py-2 text-sm">Search</button>
          </div>
          <button onClick={useMyLocation} className="outline-button w-full px-4 py-2.5 text-sm">Use my current location</button>
        </div>
        <div className="mt-8 border-t border-[#d1c9bf] pt-6">
          <div className="flex items-center justify-between"><span className="tiny-label text-[#515151]">Nearby options</span>{isSearching && <span className="text-xs text-[#b05a36]">Searching places…</span>}</div>
          <div className="mt-4 space-y-3">
            {!isSearching && stores.length === 0 && <p className="rounded-2xl bg-[#fef9ef] p-4 text-sm text-[#515151]">Choose a location to bring up live food and supplement options. No stored reviews are shown here.</p>}
            {stores.map(store => <div key={`${store.name}-${store.address}`} className="rounded-2xl border border-[#d1c9bf] bg-[#fef9ef] p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{store.name}</p><p className="mt-1 text-xs text-[#515151]">{store.address}</p></div>{store.rating !== undefined && <span className="rounded-full bg-[#e6eddc] px-2.5 py-1 text-xs font-semibold text-[#44603d]">{store.rating.toFixed(1)} · Google</span>}</div>
              <button onClick={() => showDirections(store)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#a54f2e]">Directions <ArrowRight className="size-3.5" /></button>
            </div>)}
          </div>
        </div>
      </div>
      <div className="journal-card min-h-[620px] overflow-hidden p-2"><MapView className="h-[610px] rounded-[18px]" initialCenter={centerRef.current} initialZoom={11} onMapReady={liveMap => { setMap(liveMap); findStores(liveMap, centerRef.current); }} /></div>
    </section>
  );
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const [activeView, setActiveView] = useState<View>("today");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(true);
  const [profile, setProfile] = useState<NutritionProfile>(defaultProfile);
  const [targets, setTargets] = useState<NutritionTargets>(() => calculateTargets(defaultProfile));
  const [hydration, setHydration] = useState(0);
  const [logged, setLogged] = useState<FoodLog>({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [savedMeals, setSavedMeals] = useState<string[]>([]);
  const [weightHistory, setWeightHistory] = useState<{ label: string; value: number }[]>([]);
  const [checkInWeight, setCheckInWeight] = useState(defaultProfile.weightKg);
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: "You are Sol, a calm, encouraging nutrition coach." },
    { role: "assistant", content: "I’m **Sol**. When you’re ready, tell me how your energy feels today and we’ll choose one kind next step." },
  ]);

  const calculateMutation = trpc.nutrition.calculate.useMutation();
  const saveProfileMutation = trpc.nutrition.saveProfile.useMutation();
  const feedbackMutation = trpc.nutrition.recordFeedback.useMutation();
  const progressMutation = trpc.nutrition.recordProgress.useMutation();
  const coachMutation = trpc.coach.chat.useMutation();

  const mealSuggestions = useMemo(() => getMealSuggestions(profile.goal, targets, profile.dietaryPreference), [profile.goal, profile.dietaryPreference, targets]);
  const macroData = [
    { name: "Protein", value: targets.proteinGrams, fill: "#8052ff" },
    { name: "Carbs", value: targets.carbGrams, fill: "#ffb829" },
    { name: "Fats", value: targets.fatGrams, fill: "#15846e" },
  ];
  const macroProgress = [
    { label: "Protein", current: logged.protein, target: targets.proteinGrams, color: "#8052ff" },
    { label: "Carbs", current: logged.carbs, target: targets.carbGrams, color: "#ffb829" },
    { label: "Fats", current: logged.fats, target: targets.fatGrams, color: "#15846e" },
  ];
  const streak = Math.max(0, savedMeals.length + hydration);

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    calculateMutation.mutate(profile, {
      onSuccess: result => {
        setTargets(result);
        setCheckInWeight(profile.weightKg);
        setWeightHistory([{ label: "Start", value: profile.weightKg }]);
        if (isAuthenticated) saveProfileMutation.mutate(profile);
        setIsOnboardingOpen(false);
        setActiveView("today");
        toast.success("Your daily rhythm is ready.");
      },
      onError: () => toast.error("Please check the profile details and try again."),
    });
  };

  const logMeal = (meal: MealSuggestion) => {
    setLogged(current => ({ calories: current.calories + meal.calories, protein: current.protein + meal.protein, carbs: current.carbs + meal.carbs, fats: current.fats + meal.fats }));
    setSavedMeals(current => current.includes(meal.id) ? current : [...current, meal.id]);
    if (isAuthenticated) feedbackMutation.mutate({ mealId: meal.id, signal: "saved" });
    toast.success(`${meal.name} added to today.`);
  };

  const sendCoachMessage = (content: string) => {
    setMessages(current => [...current, { role: "user", content }]);
    coachMutation.mutate({
      message: content,
      profile,
      progress: { caloriesConsumed: logged.calories, waterGlasses: hydration, streak, preferenceSignals: savedMeals.length ? ["saved whole-food meal ideas", "prefers planned meals"] : [] },
    }, {
      onSuccess: response => setMessages(current => [...current, { role: "assistant", content: response.message }]),
      onError: () => setMessages(current => [...current, { role: "assistant", content: "I couldn’t reach the coach just now. A gentle fallback: take one breath, drink a glass of water if you need it, and make your next meal a little more nourishing than the last." }]),
    });
  };

  const addCheckIn = () => {
    if (!checkInWeight || checkInWeight < 35) return;
    const next = [...weightHistory, { label: `Check-in ${weightHistory.length}`, value: Number(checkInWeight) }];
    setWeightHistory(next);
    if (isAuthenticated) progressMutation.mutate({ weightKg: Number(checkInWeight) });
    toast.success("Check-in added to your private progress line.");
  };

  const selectView = (view: View) => { setActiveView(view); setIsMenuOpen(false); };

  const todayView = <section className="smooth-enter space-y-6">
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <div className="journal-card relative overflow-hidden p-7 md:p-10"><div className="organic-orb -right-20 -top-32 size-72 bg-[#e7b096]/45" /><div className="organic-orb -bottom-44 right-28 size-72 bg-[#afbe96]/35" />
        <div className="relative"><div className="flex items-center gap-2 text-[#a54f2e]"><span className="tiny-label">Daily practice</span><span className="h-px w-12 bg-[#b05a36]/50" /></div>
          <h1 className="mt-5 max-w-xl text-5xl leading-[.94] md:text-6xl">Nourish the work <em className="font-normal text-[#b05a36]">you’re becoming.</em></h1>
          <div className="mt-5 max-w-xl"><GoalCopy goal={profile.goal} /></div>
          <div className="mt-9 flex flex-wrap gap-3"><button onClick={() => setActiveView("plan")} className="terracotta-button inline-flex items-center gap-2 px-5 py-3 text-sm">See today’s food plan <ArrowRight className="size-4" /></button><button onClick={() => setIsOnboardingOpen(true)} className="outline-button px-5 py-3 text-sm">Refine my profile</button></div>
          <div className="mt-10 flex flex-wrap gap-8 border-t border-[#d1c9bf] pt-6"><div><p className="tiny-label text-[#515151]">Daily target</p><p className="mt-2 text-3xl font-semibold">{targets.calorieTarget.toLocaleString()} <span className="text-base font-normal">kcal</span></p></div><div><p className="tiny-label text-[#515151]">Training rhythm</p><p className="mt-2 max-w-[220px] text-sm font-medium">{profile.workoutRoutine}</p></div></div>
        </div>
      </div>
      <div className="journal-card p-7 md:p-8"><div className="flex items-center justify-between"><div><p className="tiny-label text-[#515151]">Energy ledger</p><h2 className="mt-2 text-3xl">Keep it gentle.</h2></div><Flame className="size-6 text-[#b05a36]" /></div>
        <div className="mt-7"><div className="flex items-end justify-between"><span className="text-5xl font-semibold">{logged.calories.toLocaleString()}</span><span className="pb-1 text-sm text-[#515151]">of {targets.calorieTarget.toLocaleString()} kcal</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e7dfd4]"><div className="h-full rounded-full bg-[#b05a36] transition-all duration-500" style={{ width: `${metricPercent(logged.calories, targets.calorieTarget)}%` }} /></div><p className="mt-3 text-xs text-[#515151]">Planning is guidance, not a scorecard. Notice how your body feels, too.</p></div>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#d1c9bf] pt-5">{macroProgress.map(macro => <div key={macro.label}><p className="tiny-label text-[#515151]">{macro.label}</p><p className="mt-1 text-sm font-semibold">{macro.current} <span className="font-normal text-[#515151]">/ {macro.target}g</span></p></div>)}</div>
      </div>
    </div>
    <div className="grid gap-6 lg:grid-cols-3"><div className="journal-card p-6"><div className="flex items-center justify-between"><div><p className="tiny-label text-[#515151]">Macro compass</p><h2 className="mt-1 text-2xl">A balanced map.</h2></div><Target className="size-5 text-[#b05a36]" /></div><div className="mt-3 h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={macroData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={3} stroke="none" /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-3 gap-2 text-center">{macroData.map(item => <div key={item.name}><span className="mx-auto block size-2 rounded-full" style={{ backgroundColor: item.fill }} /><p className="mt-1 text-xs font-semibold">{item.value}g</p><p className="text-[10px] text-[#515151]">{item.name}</p></div>)}</div></div>
      <div className="journal-card p-6"><div className="flex items-center justify-between"><div><p className="tiny-label text-[#515151]">Hydration ritual</p><h2 className="mt-1 text-2xl">Sip, don’t sprint.</h2></div><Droplets className="size-5 text-[#7199a1]" /></div><div className="mt-6 grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, index) => <button key={index} onClick={() => setHydration(value => index < value ? index : index + 1)} className={`flex aspect-square items-center justify-center rounded-full border ${index < hydration ? "border-[#7199a1] bg-[#dcecf0] text-[#4c7580]" : "border-[#d1c9bf] bg-[#fef9ef] text-[#a9aaa5]"}`} aria-label={`Set hydration to ${index + 1} glasses`}><Droplets className="size-4" /></button>)}</div><div className="mt-5 flex items-center justify-between"><p className="text-sm text-[#515151]"><strong className="text-[#2a2b2f]">{hydration} of 8</strong> glasses noticed</p><button onClick={() => setHydration(0)} className="text-xs font-semibold text-[#a54f2e]">Reset</button></div></div>
      <div className="journal-card p-6"><div className="flex items-center justify-between"><div><p className="tiny-label text-[#515151]">Nutrient note</p><h2 className="mt-1 text-2xl">Build colour in.</h2></div><Leaf className="size-5 text-[#5f7e55]" /></div><div className="mt-5 rounded-2xl bg-[#e6eddc] p-4"><p className="text-sm font-semibold text-[#334d2f]">One gentle focus</p><p className="mt-1 text-sm leading-relaxed text-[#44603d]">Add a colourful fruit or vegetable to your next plate. It’s a simple way to make room for fibre and micronutrients.</p></div><div className="mt-5 flex items-center gap-2 text-xs text-[#515151]"><Sparkles className="size-3.5 text-[#b05a36]" /> {streak} small action{streak === 1 ? "" : "s"} collected today</div></div>
    </div>
    <div className="journal-card p-6 md:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="tiny-label text-[#515151]">Today’s first idea</p><h2 className="mt-2 text-3xl">{mealSuggestions[0].name}</h2><p className="mt-2 text-sm text-[#515151]">{mealSuggestions[0].ingredients.join(" · ")}</p></div><button onClick={() => logMeal(mealSuggestions[0])} className="terracotta-button px-5 py-3 text-sm">Log this meal</button></div></div>
  </section>;

  const planView = <section className="smooth-enter space-y-6"><div className="journal-card p-7 md:p-9"><p className="tiny-label text-[#a54f2e]">Food plan</p><h1 className="mt-4 max-w-3xl text-5xl leading-[.94] md:text-6xl">Meals with a <em className="font-normal text-[#b05a36]">reason</em> to be there.</h1><p className="mt-5 max-w-2xl text-[#515151]">Each idea is scaled from your calculated daily target and shaped around {profile.dietaryPreference} preferences. Save or skip the suggestions that feel most like you.</p></div><div className="grid gap-5 lg:grid-cols-3">{mealSuggestions.map((meal, index) => <article key={meal.id} className="journal-card overflow-hidden p-6"><div className="flex items-center justify-between"><span className="tiny-label text-[#a54f2e]">0{index + 1} · {meal.moment}</span><span className="rounded-full bg-[#e6eddc] px-3 py-1 text-xs font-semibold text-[#44603d]">{meal.calories} kcal</span></div><h2 className="mt-5 text-3xl leading-tight">{meal.name}</h2><p className="mt-3 min-h-10 text-sm text-[#515151]">{meal.note}</p><div className="mt-5 rounded-2xl bg-[#fef9ef] p-4"><p className="tiny-label text-[#515151]">Gather</p><p className="mt-2 text-sm leading-relaxed">{meal.ingredients.join(" · ")}</p></div><div className="mt-5 grid grid-cols-3 border-t border-[#d1c9bf] pt-4 text-center"><div><p className="tiny-label text-[#515151]">Protein</p><p className="mt-1 text-sm font-semibold">{meal.protein}g</p></div><div><p className="tiny-label text-[#515151]">Carbs</p><p className="mt-1 text-sm font-semibold">{meal.carbs}g</p></div><div><p className="tiny-label text-[#515151]">Fats</p><p className="mt-1 text-sm font-semibold">{meal.fats}g</p></div></div><div className="mt-5 flex gap-2"><button onClick={() => logMeal(meal)} className="terracotta-button flex-1 px-4 py-2.5 text-sm">{savedMeals.includes(meal.id) ? "Added today" : "Log meal"}</button><button onClick={() => { if (isAuthenticated) feedbackMutation.mutate({ mealId: meal.id, signal: "skipped" }); toast.message("We’ll soften this kind of suggestion over time."); }} className="outline-button px-3 py-2.5" aria-label={`Skip ${meal.name}`}><Minus className="size-4" /></button></div></article>)}</div><div className="journal-card p-7 md:p-8"><div className="flex items-center gap-3 text-[#5f7e55]"><Leaf className="size-5" /><span className="tiny-label">Supplement guide</span></div><h2 className="mt-4 text-4xl">Evidence first, hype last.</h2><p className="mt-3 max-w-2xl text-sm text-[#515151]">General education only. These cards link to their expert references and never replace individual medical advice.</p><div className="mt-7 grid gap-4 lg:grid-cols-3">{supplementGuides.map(item => <div key={item.id} className="rounded-2xl border border-[#d1c9bf] bg-[#fef9ef] p-5"><p className="tiny-label text-[#a54f2e]">{item.bestFor}</p><h3 className="mt-3 text-2xl">{item.name}</h3><p className="mt-3 text-sm leading-relaxed text-[#515151]">{item.guidance}</p><p className="mt-3 text-xs font-semibold text-[#44603d]">{item.timing}</p><p className="mt-4 border-t border-[#ded5c9] pt-3 text-xs leading-relaxed text-[#515151]">{item.caution}</p><a className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#a54f2e] underline underline-offset-4" href={item.sourceUrl} target="_blank" rel="noreferrer">Read {item.sourceLabel} <ArrowRight className="size-3" /></a></div>)}</div></div></section>;

  const coachView = <section className="smooth-enter grid gap-6 xl:grid-cols-[.72fr_1.28fr]"><div className="journal-card p-7 md:p-8"><div className="flex items-center gap-3 text-[#b05a36]"><Sparkles className="size-5" /><span className="tiny-label">Sol, your coach</span></div><h1 className="mt-5 text-5xl leading-[.94]">A little steadiness, on demand.</h1><p className="mt-5 text-[#515151]">Sol considers the goal, day-to-day progress, and signals you share here. It supports your routines with clear encouragement, not medical judgment.</p><div className="mt-7 space-y-3"><button onClick={() => sendCoachMessage("I need a little motivation to stay consistent today.")} className="outline-button w-full px-4 py-3 text-left text-sm">I need a little motivation today <ChevronRight className="float-right size-4" /></button><button onClick={() => sendCoachMessage("What is one calm, recovery-focused choice I can make after training?")} className="outline-button w-full px-4 py-3 text-left text-sm">Help me reset after training <ChevronRight className="float-right size-4" /></button><button onClick={() => sendCoachMessage("Can you help me notice one positive thing in my progress?")} className="outline-button w-full px-4 py-3 text-left text-sm">Help me notice my progress <ChevronRight className="float-right size-4" /></button></div><div className="mt-8 rounded-2xl bg-[#e6eddc] p-4 text-sm text-[#44603d]"><strong>Kind reminder.</strong> If a question concerns symptoms, injury, medication, pregnancy, or disordered eating, bring it to a qualified professional.</div></div><AIChatBox messages={messages} onSendMessage={sendCoachMessage} isLoading={coachMutation.isPending} height="630px" placeholder="Share a check-in with Sol…" className="!rounded-[24px] !border-[#d1c9bf] !bg-[#f5eee1] [&_textarea]:!rounded-2xl [&_textarea]:!border-[#d1c9bf] [&_button[type=submit]]:!rounded-full [&_button[type=submit]]:!bg-[#b05a36]" suggestedPrompts={["How can I plan meals around an evening workout?", "Give me a short encouragement for today."]} /></section>;

  const progressView = <section className="smooth-enter grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><div className="journal-card p-7 md:p-9"><p className="tiny-label text-[#a54f2e]">Progress journal</p><h1 className="mt-4 text-5xl leading-[.94]">Growth lives in the <em className="font-normal text-[#b05a36]">small repeats.</em></h1><p className="mt-5 max-w-xl text-[#515151]">Your check-ins stay private. Log only what feels useful to notice — weight is optional and never a verdict.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><input value={checkInWeight} onChange={event => setCheckInWeight(Number(event.target.value))} type="number" min="35" step="0.1" className="h-12 flex-1 rounded-full border border-[#d1c9bf] bg-[#fef9ef] px-5 text-sm outline-none focus:border-[#b05a36]" aria-label="Current weight in kilograms" /><button onClick={addCheckIn} className="terracotta-button px-5 py-3 text-sm">Add check-in</button></div><p className="mt-2 text-xs text-[#515151]">Kilograms. This is a personal record, not a clinical assessment.</p><div className="mt-10 grid grid-cols-3 gap-3 border-t border-[#d1c9bf] pt-6"><div><p className="tiny-label text-[#515151]">Reflection streak</p><p className="mt-2 text-3xl font-semibold">{streak}</p></div><div><p className="tiny-label text-[#515151]">Meals explored</p><p className="mt-2 text-3xl font-semibold">{savedMeals.length}</p></div><div><p className="tiny-label text-[#515151]">Water noticed</p><p className="mt-2 text-3xl font-semibold">{hydration}<span className="text-base font-normal">/8</span></p></div></div></div><div className="journal-card p-6 md:p-8"><div className="flex items-center justify-between"><div><p className="tiny-label text-[#515151]">Your line</p><h2 className="mt-2 text-3xl">Check-ins over time</h2></div><Activity className="size-5 text-[#b05a36]" /></div>{weightHistory.length ? <div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={weightHistory} margin={{ left: -22, right: 10, top: 10, bottom: 0 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,.14)" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#bdbdbd", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#bdbdbd", fontSize: 11 }} domain={["dataMin - 2", "dataMax + 2"]} /><Tooltip cursor={{ stroke: "#8052ff", strokeWidth: 1 }} contentStyle={{ borderRadius: 16, border: "1px solid rgba(255,255,255,.2)", background: "#101010", color: "#ffffff" }} /><Line type="monotone" dataKey="value" stroke="#8052ff" strokeWidth={3} dot={{ r: 4, fill: "#8052ff" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div> : <div className="mt-7 flex h-72 flex-col items-center justify-center rounded-2xl bg-[#fef9ef] text-center"><Dumbbell className="size-7 text-[#b05a36]" /><p className="mt-3 text-sm font-semibold">Your private line will appear here.</p><p className="mt-1 max-w-xs text-xs text-[#515151]">Complete onboarding and add a check-in when it’s meaningful to you.</p></div>}</div></section>;

  const membershipView = <section className="smooth-enter space-y-6"><div className="journal-card relative overflow-hidden p-8 md:p-12"><div className="organic-orb -right-10 -top-16 size-72 bg-[#d79d7f]/30" /><div className="relative"><p className="tiny-label text-[#a54f2e]">Membership</p><h1 className="mt-4 max-w-3xl text-5xl leading-[.94] md:text-7xl">More support, <em className="font-normal text-[#b05a36]">less noise.</em></h1><p className="mt-5 max-w-xl text-[#515151]">Choose a cadence that keeps your wellness tools intentional. Yearly membership lowers the effective monthly cost.</p></div></div><div className="grid gap-5 lg:grid-cols-2"><div className="journal-card p-7"><p className="tiny-label text-[#515151]">Monthly</p><h2 className="mt-3 text-4xl">$6.99 <span className="text-base font-normal text-[#515151]">/ month</span></h2><p className="mt-4 text-sm text-[#515151]">A flexible starting point for your daily plan, recommendations, and coach check-ins.</p><button onClick={() => toast.message("Secure checkout will open here once payment keys are connected.")} className="outline-button mt-7 w-full px-5 py-3 text-sm">Choose monthly</button></div><div className="rounded-[24px] border border-[#b05a36] bg-[#b05a36] p-7 text-[#fffaf1]"><div className="flex items-start justify-between"><p className="tiny-label text-[#f8ded2]">Yearly</p><span className="rounded-full bg-[#f8ded2] px-3 py-1 text-xs font-bold text-[#8a3d23]">Save 29%</span></div><h2 className="mt-3 text-4xl">$59.99 <span className="text-base font-normal text-[#f8ded2]">/ year</span></h2><p className="mt-4 text-sm text-[#f8ded2]">That’s $5.00 per month, billed annually, with room for seasonal offers when available.</p><button onClick={() => toast.message("Secure checkout will open here once payment keys are connected.")} className="mt-7 w-full rounded-full bg-[#fffaf1] px-5 py-3 text-sm font-semibold text-[#8a3d23]">Choose yearly</button></div></div><div className="journal-card overflow-hidden"><div className="border-b border-[#d1c9bf] p-7"><p className="tiny-label text-[#515151]">Compare membership</p><h2 className="mt-2 text-3xl">A clear view of what’s included.</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-sm"><thead className="bg-[#f0e7d9] text-left"><tr><th className="p-4 font-semibold">Included</th><th className="p-4 font-semibold">Monthly</th><th className="p-4 font-semibold">Yearly</th></tr></thead><tbody>{[["Daily calorie & macro targets", true, true], ["Adaptive meal suggestions", true, true], ["Progress journal", true, true], ["Sol AI coach check-ins", true, true], ["Priority seasonal plan refreshes", false, true]].map(([feature, monthly, yearly]) => <tr key={String(feature)} className="border-t border-[#ded5c9]"><td className="p-4">{String(feature)}</td><td className="p-4">{monthly ? <Check className="size-4 text-[#5f7e55]" /> : "—"}</td><td className="p-4">{yearly ? <Check className="size-4 text-[#5f7e55]" /> : "—"}</td></tr>)}</tbody></table></div></div><p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-[#515151]">Checkout is designed to use a secure, provider-hosted payment page. It is intentionally inactive until the account owner connects a payment provider, so card details are never handled by this interface.</p></section>;

  const content = activeView === "today" ? todayView : activeView === "plan" ? planView : activeView === "coach" ? coachView : activeView === "stores" ? <StoreFinder /> : activeView === "progress" ? progressView : membershipView;

  return <div className="paper-grid min-h-screen overflow-x-hidden bg-[#fef9ef] text-[#2a2b2f]"><div className="organic-orb -left-36 top-24 size-96 bg-[#e6bc89]/22" /><div className="organic-orb -right-48 top-[420px] size-[36rem] bg-[#adc09a]/16" />
    <div className="relative mx-auto min-h-screen max-w-[1440px] px-4 pb-10 pt-4 sm:px-6 lg:px-10"><header className="sticky top-4 z-30 flex items-center justify-between rounded-xl border border-[#d1c9bf] bg-[#fef9ef]/90 px-4 py-3 shadow-[0_10px_30px_rgba(42,43,47,.05)] backdrop-blur md:px-6"><button onClick={() => selectView("today")} className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-full bg-[#b05a36] font-display text-lg italic text-[#fffaf1]">N</span><span className="text-left"><span className="block font-display text-xl leading-none">Nutria</span><span className="tiny-label mt-1 block text-[#515151]">Journal</span></span></button><nav className="hidden items-center gap-1 lg:flex">{navigation.map(item => <button key={item.id} onClick={() => selectView(item.id)} className={`rounded-full px-3 py-2 text-sm ${activeView === item.id ? "bg-[#f0e7d9] font-semibold text-[#a54f2e]" : "text-[#515151] hover:bg-[#f5eee1]"}`}>{item.label}</button>)}</nav><div className="hidden items-center gap-2 sm:flex"><button onClick={() => selectView("membership")} className="outline-button px-4 py-2 text-sm">Membership</button>{isAuthenticated ? <span className="rounded-full bg-[#e6eddc] px-3 py-2 text-xs font-semibold text-[#44603d]">{user?.name ?? "Member"}</span> : <button onClick={startLogin} className="terracotta-button px-4 py-2 text-sm">Save my journal</button>}</div><button onClick={() => setIsMenuOpen(value => !value)} className="rounded-full p-2 hover:bg-[#f0e7d9] lg:hidden" aria-label="Open navigation">{isMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button></header>{isMenuOpen && <div className="relative z-20 mt-2 rounded-2xl border border-[#d1c9bf] bg-[#fef9ef] p-2 shadow-lg lg:hidden">{[...navigation, { id: "membership" as View, label: "Membership" }].map(item => <button key={item.id} onClick={() => selectView(item.id)} className="block w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-[#f5eee1]">{item.label}</button>)}</div>}<main className="relative mx-auto max-w-[1280px] py-8 md:py-12">{content}</main><footer className="relative mx-auto flex max-w-[1280px] flex-col justify-between gap-4 border-t border-[#d1c9bf] py-7 text-xs text-[#515151] md:flex-row"><p>Nutria Journal is an educational wellness companion, not medical care.</p><div className="flex gap-4"><button onClick={() => setActiveView("coach")} className="hover:text-[#a54f2e]">Safety note</button><button onClick={() => setIsOnboardingOpen(true)} className="hover:text-[#a54f2e]">Profile settings</button></div></footer></div>
    {isOnboardingOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2a2b2f]/35 p-3 backdrop-blur-sm md:p-8"><div className="mx-auto my-4 max-w-5xl overflow-hidden rounded-[32px] border border-[#d1c9bf] bg-[#fef9ef] shadow-[12px_32px_80px_rgba(42,43,47,.18)]"><div className="grid lg:grid-cols-[.8fr_1.2fr]"><aside className="relative overflow-hidden bg-[#b05a36] p-8 text-[#fffaf1] md:p-11"><div className="organic-orb -right-28 top-12 size-72 bg-[#f5c7b2]/30" /><div className="organic-orb -bottom-36 -left-24 size-80 bg-[#d2dbba]/25" /><div className="relative"><span className="tiny-label text-[#f8ded2]">A gentler beginning</span><h1 className="mt-5 text-5xl leading-[.93]">A plan that starts with <em className="font-normal">you.</em></h1><p className="mt-6 max-w-sm text-sm leading-relaxed text-[#f8ded2]">Tell us the basics, then we’ll make a transparent energy and macro estimate you can revise as your life changes.</p><div className="mt-12 space-y-4"><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fffaf1] text-xs font-bold text-[#a54f2e]">1</span><p className="text-sm text-[#f8ded2]">Mifflin–St Jeor gives a baseline energy estimate.</p></div><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fffaf1] text-xs font-bold text-[#a54f2e]">2</span><p className="text-sm text-[#f8ded2]">Activity and goal shape your daily target.</p></div><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#fffaf1] text-xs font-bold text-[#a54f2e]">3</span><p className="text-sm text-[#f8ded2]">You keep the final say. This is a starting point, not a prescription.</p></div></div></div></aside><form onSubmit={handlePlanSubmit} className="p-7 md:p-10"><div className="flex items-start justify-between gap-5"><div><p className="tiny-label text-[#a54f2e]">Your starting profile</p><h2 className="mt-3 text-4xl">Let’s make the math feel human.</h2></div><button type="button" onClick={() => setIsOnboardingOpen(false)} className="rounded-full p-2 hover:bg-[#f0e7d9]" aria-label="Close onboarding"><X className="size-5" /></button></div><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="block"><span className="tiny-label text-[#515151]">Age</span><input required min="18" max="100" type="number" value={profile.age} onChange={event => setProfile({ ...profile, age: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]" /></label><label className="block"><span className="tiny-label text-[#515151]">Gender used for equation</span><select value={profile.gender} onChange={event => setProfile({ ...profile, gender: event.target.value as NutritionProfile["gender"] })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]"><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary / use midpoint</option><option value="prefer-not-to-say">Prefer not to say / use midpoint</option></select></label><label className="block"><span className="tiny-label text-[#515151]">Weight (kg)</span><input required min="35" step="0.1" type="number" value={profile.weightKg} onChange={event => setProfile({ ...profile, weightKg: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]" /></label><label className="block"><span className="tiny-label text-[#515151]">Height (cm)</span><input required min="120" max="240" type="number" value={profile.heightCm} onChange={event => setProfile({ ...profile, heightCm: Number(event.target.value) })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]" /></label><label className="block"><span className="tiny-label text-[#515151]">Primary focus</span><select value={profile.goal} onChange={event => setProfile({ ...profile, goal: event.target.value as NutritionProfile["goal"] })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]"><option value="fat-loss">Fat loss</option><option value="maintain">Maintain & feel steady</option><option value="muscle-gain">Build muscle</option><option value="performance">Performance</option></select></label><label className="block"><span className="tiny-label text-[#515151]">Daily movement</span><select value={profile.activityLevel} onChange={event => setProfile({ ...profile, activityLevel: event.target.value as NutritionProfile["activityLevel"] })} className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none focus:border-[#b05a36]"><option value="sedentary">Mostly seated</option><option value="light">Light movement</option><option value="moderate">Moderately active</option><option value="very-active">Very active</option><option value="athlete">Training most days</option></select></label><label className="block sm:col-span-2"><span className="tiny-label text-[#515151]">Food preference</span><input required value={profile.dietaryPreference} onChange={event => setProfile({ ...profile, dietaryPreference: event.target.value })} placeholder="e.g. vegetarian, halal, no preference" className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none placeholder:text-[#808988] focus:border-[#b05a36]" /></label><label className="block sm:col-span-2"><span className="tiny-label text-[#515151]">Workout rhythm</span><input required value={profile.workoutRoutine} onChange={event => setProfile({ ...profile, workoutRoutine: event.target.value })} placeholder="e.g. two morning runs and three evening lifts" className="mt-2 h-12 w-full rounded-full border border-[#d1c9bf] bg-[#f5eee1] px-5 text-sm outline-none placeholder:text-[#808988] focus:border-[#b05a36]" /></label></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 text-xs leading-relaxed text-[#515151]"><CircleHelp className="mt-0.5 size-3.5 shrink-0" />For healthy adults. Consult a qualified professional for medical or individualized nutrition needs.</p><button disabled={calculateMutation.isPending} className="terracotta-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-60">{calculateMutation.isPending ? "Calculating…" : "Create my daily rhythm"} <ArrowRight className="size-4" /></button></div></form></div></div></div>}
  </div>;
}
