#!/usr/bin/env python3
"""Generates supabase/migrations/20261019000500_starter_data.sql.

Starter foods are approximate reference values for generic foods. They are stored with
source = 'starter_reference' and verification = 'estimated' and the UI labels them as
estimates. Energy is derived from the macros with EU Atwater factors
(protein 4, carbohydrate 4, fat 9, fibre 2 kcal/g) so every row is internally consistent.

Replace or complement these rows with an authoritative import (for example the Swedish
Food Agency's food database) for verified values.

Run: python3 scripts/generate-starter-data.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "supabase/migrations/20261019000500_starter_data.sql"

# name, canonical, category, preparation, protein, carbs, fat, fiber, allergens, allergens_known, diet_tags, servings
FOODS = [
    # Kött och fisk
    ("Kycklingbröstfilé, rå", "kycklingbröstfilé", "meat_fish", "raw", 23.0, 0, 1.5, 0, [], True, [], [("1 filé", 125)]),
    ("Kycklingbröstfilé, stekt", "kycklingbröstfilé", "meat_fish", "cooked", 31.0, 0, 3.0, 0, [], True, [], [("1 filé", 95)]),
    ("Kycklinglårfilé, rå", "kycklinglårfilé", "meat_fish", "raw", 19.0, 0, 6.5, 0, [], True, [], [("1 filé", 90)]),
    ("Nötfärs 10 %, rå", "nötfärs 10 %", "meat_fish", "raw", 19.5, 0, 10.0, 0, [], True, [], []),
    ("Nötfärs 5 %, rå", "nötfärs 5 %", "meat_fish", "raw", 21.0, 0, 5.0, 0, [], True, [], []),
    ("Fläskfilé, rå", "fläskfilé", "meat_fish", "raw", 21.5, 0, 2.5, 0, [], True, [], []),
    ("Kalkonbröst, rå", "kalkonbröst", "meat_fish", "raw", 24.0, 0, 1.0, 0, [], True, [], []),
    ("Laxfilé, rå", "laxfilé", "meat_fish", "raw", 20.0, 0, 13.0, 0, ["fish"], True, [], [("1 bit", 125)]),
    ("Torskfilé, rå", "torskfilé", "meat_fish", "raw", 17.5, 0, 0.7, 0, ["fish"], True, [], [("1 bit", 125)]),
    ("Tonfisk i vatten, avrunnen", "tonfisk i vatten", "meat_fish", "as_sold", 25.0, 0, 1.0, 0, ["fish"], False, [], [("1 burk avrunnen", 120)]),
    ("Räkor, skalade, kokta", "räkor skalade", "meat_fish", "cooked", 17.0, 0, 0.8, 0, ["shellfish"], True, [], []),
    ("Skinka, kokt pålägg", "kokt skinka pålägg", "meat_fish", "as_sold", 18.0, 1.5, 3.5, 0, [], False, [], [("1 skiva", 15)]),
    # Mejeri och alternativ
    ("Ägg, rått", "ägg", "dairy", "raw", 12.5, 0.3, 10.0, 0, ["egg"], True, ["vegetarian"], [("1 ägg (utan skal)", 50)]),
    ("Mjölk 1,5 %", "mjölk 1,5 %", "dairy", "as_sold", 3.5, 4.8, 1.5, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 dl", 103), ("1 glas (2 dl)", 206)]),
    ("Kvarg naturell 0,2 %", "kvarg naturell", "dairy", "as_sold", 11.0, 4.0, 0.2, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 dl", 105)]),
    ("Grekisk yoghurt 10 %", "grekisk yoghurt 10 %", "dairy", "as_sold", 3.5, 4.0, 10.0, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 dl", 105)]),
    ("Naturell yoghurt 3 %", "naturell yoghurt 3 %", "dairy", "as_sold", 3.5, 4.5, 3.0, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 dl", 104)]),
    ("Keso 4 %", "keso 4 %", "dairy", "as_sold", 12.5, 2.3, 4.0, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 dl", 95)]),
    ("Hårdost 28 %", "hårdost 28 %", "dairy", "as_sold", 26.0, 0, 28.0, 0, ["milk"], True, ["vegetarian"], [("1 skiva", 10)]),
    ("Mozzarella", "mozzarella", "dairy", "as_sold", 18.0, 1.0, 20.0, 0, ["milk", "lactose"], True, ["vegetarian"], [("1 kula", 125)]),
    ("Fetaost", "fetaost", "dairy", "as_sold", 15.0, 1.0, 21.0, 0, ["milk"], True, ["vegetarian"], []),
    ("Smör", "smör", "dairy", "as_sold", 0.6, 0.6, 80.0, 0, ["milk"], True, ["vegetarian"], [("1 tsk", 5), ("1 msk", 14)]),
    ("Havredryck, osötad", "havredryck", "dairy", "as_sold", 1.0, 6.7, 1.5, 0.8, ["gluten"], False, ["vegan", "vegetarian"], [("1 dl", 100)]),
    ("Sojadryck, osötad", "sojadryck", "dairy", "as_sold", 3.3, 0.5, 1.9, 0.5, ["soy"], False, ["vegan", "vegetarian"], [("1 dl", 100)]),
    # Spannmål och pasta
    ("Havregryn", "havregryn", "grains", "dried", 13.0, 58.0, 7.0, 10.0, ["gluten"], True, ["vegan", "vegetarian"], [("1 dl", 35)]),
    ("Jasminris, okokt", "jasminris", "grains", "dried", 7.0, 78.0, 0.6, 1.0, [], True, ["vegan", "vegetarian"], [("1 dl", 85)]),
    ("Jasminris, kokt", "jasminris", "grains", "cooked", 2.6, 28.5, 0.3, 0.4, [], True, ["vegan", "vegetarian"], [("1 dl", 70)]),
    ("Pasta, okokt", "pasta", "grains", "dried", 12.5, 71.0, 1.5, 3.0, ["gluten"], True, ["vegan", "vegetarian"], []),
    ("Pasta, kokt", "pasta", "grains", "cooked", 5.2, 29.6, 0.6, 1.2, ["gluten"], True, ["vegan", "vegetarian"], []),
    ("Fullkornspasta, okokt", "fullkornspasta", "grains", "dried", 13.5, 65.0, 2.5, 8.0, ["gluten"], True, ["vegan", "vegetarian"], []),
    ("Quinoa, okokt", "quinoa", "grains", "dried", 14.0, 60.0, 6.0, 7.0, [], True, ["vegan", "vegetarian"], [("1 dl", 85)]),
    ("Knäckebröd, fullkornsråg", "knäckebröd fullkornsråg", "grains", "as_sold", 9.0, 61.0, 1.6, 17.0, ["gluten"], False, ["vegan", "vegetarian"], [("1 skiva", 13)]),
    ("Rågbröd, skivat", "rågbröd", "grains", "as_sold", 8.0, 40.0, 3.5, 7.0, ["gluten"], False, ["vegetarian"], [("1 skiva", 35)]),
    ("Tortillabröd, vete", "tortillabröd vete", "grains", "as_sold", 8.0, 50.0, 7.0, 2.5, ["gluten"], False, ["vegetarian"], [("1 tortilla", 40)]),
    # Frukt och grönt
    ("Potatis, rå", "potatis", "produce", "raw", 2.0, 16.5, 0.1, 1.6, [], True, ["vegan", "vegetarian"], [("1 medelstor", 90)]),
    ("Potatis, kokt", "potatis", "produce", "cooked", 2.0, 17.0, 0.1, 1.6, [], True, ["vegan", "vegetarian"], [("1 medelstor", 90)]),
    ("Sötpotatis, rå", "sötpotatis", "produce", "raw", 1.6, 17.0, 0.1, 3.0, [], True, ["vegan", "vegetarian"], []),
    ("Banan", "banan", "produce", "as_sold", 1.1, 20.0, 0.3, 2.6, [], True, ["vegan", "vegetarian"], [("1 banan (utan skal)", 120)]),
    ("Äpple", "äpple", "produce", "as_sold", 0.3, 11.5, 0.2, 2.2, [], True, ["vegan", "vegetarian"], [("1 äpple", 150)]),
    ("Apelsin", "apelsin", "produce", "as_sold", 0.9, 8.5, 0.1, 2.0, [], True, ["vegan", "vegetarian"], [("1 apelsin (utan skal)", 140)]),
    ("Blåbär", "blåbär", "produce", "as_sold", 0.7, 9.0, 0.6, 2.5, [], True, ["vegan", "vegetarian"], [("1 dl", 65)]),
    ("Hallon", "hallon", "produce", "as_sold", 1.2, 5.0, 0.6, 4.6, [], True, ["vegan", "vegetarian"], [("1 dl", 55)]),
    ("Jordgubbar", "jordgubbar", "produce", "as_sold", 0.7, 6.0, 0.3, 2.0, [], True, ["vegan", "vegetarian"], [("1 dl", 70)]),
    ("Broccoli, rå", "broccoli", "produce", "raw", 3.0, 4.0, 0.4, 2.6, [], True, ["vegan", "vegetarian"], []),
    ("Spenat, rå", "spenat", "produce", "raw", 2.9, 1.4, 0.4, 2.2, [], True, ["vegan", "vegetarian"], []),
    ("Tomat", "tomat", "produce", "raw", 0.9, 3.0, 0.2, 1.2, [], True, ["vegan", "vegetarian"], [("1 tomat", 90)]),
    ("Gurka", "gurka", "produce", "raw", 0.7, 2.0, 0.1, 0.6, [], True, ["vegan", "vegetarian"], []),
    ("Paprika, röd", "paprika röd", "produce", "raw", 1.0, 5.5, 0.3, 1.8, [], True, ["vegan", "vegetarian"], [("1 paprika", 150)]),
    ("Gul lök", "gul lök", "produce", "raw", 1.2, 7.0, 0.1, 1.6, [], True, ["vegan", "vegetarian"], [("1 lök", 80)]),
    ("Vitlök", "vitlök", "produce", "raw", 6.4, 28.0, 0.5, 2.1, [], True, ["vegan", "vegetarian"], [("1 klyfta", 4)]),
    ("Morot", "morot", "produce", "raw", 0.7, 7.0, 0.2, 2.6, [], True, ["vegan", "vegetarian"], [("1 morot", 70)]),
    ("Zucchini", "zucchini", "produce", "raw", 1.3, 2.2, 0.3, 1.0, [], True, ["vegan", "vegetarian"], []),
    ("Avokado", "avokado", "produce", "raw", 1.9, 1.8, 15.0, 6.7, [], True, ["vegan", "vegetarian"], [("1 avokado (utan kärna)", 140)]),
    ("Isbergssallad", "isbergssallad", "produce", "raw", 0.8, 2.0, 0.1, 1.0, [], True, ["vegan", "vegetarian"], []),
    ("Gröna ärtor, frysta", "gröna ärtor", "produce", "raw", 5.4, 9.5, 0.4, 5.0, [], True, ["vegan", "vegetarian"], [("1 dl", 60)]),
    # Skafferi
    ("Olivolja", "olivolja", "pantry", "as_sold", 0, 0, 100.0, 0, [], True, ["vegan", "vegetarian"], [("1 tsk", 4.5), ("1 msk", 13)]),
    ("Rapsolja", "rapsolja", "pantry", "as_sold", 0, 0, 100.0, 0, [], True, ["vegan", "vegetarian"], [("1 tsk", 4.5), ("1 msk", 13)]),
    ("Jordnötssmör", "jordnötssmör", "pantry", "as_sold", 25.0, 13.0, 50.0, 6.0, ["peanuts"], False, ["vegan", "vegetarian"], [("1 msk", 16)]),
    ("Mandlar", "mandlar", "pantry", "as_sold", 21.0, 9.0, 52.0, 12.0, ["nuts"], True, ["vegan", "vegetarian"], [("1 näve", 25)]),
    ("Valnötter", "valnötter", "pantry", "as_sold", 15.0, 7.0, 65.0, 6.7, ["nuts"], True, ["vegan", "vegetarian"], [("1 näve", 25)]),
    ("Kikärtor, kokta (konserv, avrunna)", "kikärtor", "pantry", "cooked", 7.0, 15.0, 2.5, 6.0, [], False, ["vegan", "vegetarian"], [("1 burk avrunnen", 240)]),
    ("Röda linser, torkade", "röda linser", "pantry", "dried", 24.0, 48.0, 1.5, 11.0, [], True, ["vegan", "vegetarian"], [("1 dl", 85)]),
    ("Svarta bönor, kokta", "svarta bönor", "pantry", "cooked", 8.0, 15.0, 0.5, 8.7, [], False, ["vegan", "vegetarian"], []),
    ("Krossade tomater", "krossade tomater", "pantry", "as_sold", 1.2, 4.0, 0.2, 1.2, [], False, ["vegan", "vegetarian"], [("1 förpackning", 400)]),
    ("Majs, konserv", "majs", "pantry", "as_sold", 2.9, 15.0, 1.2, 2.5, [], False, ["vegan", "vegetarian"], []),
    ("Honung", "honung", "pantry", "as_sold", 0.3, 81.0, 0, 0, [], True, ["vegetarian"], [("1 tsk", 7), ("1 msk", 21)]),
    ("Sojasås", "sojasås", "pantry", "as_sold", 8.0, 5.0, 0.1, 0.8, ["soy", "gluten"], False, ["vegan", "vegetarian"], [("1 msk", 16)]),
    ("Vassleproteinpulver", "vassleproteinpulver", "pantry", "as_sold", 78.0, 7.0, 6.0, 0, ["milk", "lactose"], False, ["vegetarian"], [("1 skopa", 30)]),
    # Övrigt
    ("Tofu, naturell", "tofu", "other", "as_sold", 13.0, 1.5, 7.5, 1.0, ["soy"], False, ["vegan", "vegetarian"], []),
    ("Hummus", "hummus", "other", "as_sold", 7.0, 11.0, 15.0, 5.5, ["sesame"], False, ["vegan", "vegetarian"], [("1 msk", 15)]),
    ("Mörk choklad 70 %", "mörk choklad 70 %", "other", "as_sold", 8.0, 33.0, 42.0, 11.0, ["milk"], False, ["vegetarian"], [("1 bit", 10)]),
]

# slug, name, primary, secondary, equipment, mechanics, instructions
EXERCISES = [
    # Bröst
    ("bankpress", "Bänkpress", ["chest"], ["triceps", "shoulders"], "barbell", "compound",
     ["Ligg på bänken med fötterna i golvet och skulderbladen indragna.", "Greppa stången något bredare än axelbredd.", "Sänk stången kontrollerat mot nedre delen av bröstet.", "Pressa upp till raka armar utan att tappa spänningen i ryggen."]),
    ("lutande-bankpress", "Lutande bänkpress", ["chest"], ["shoulders", "triceps"], "barbell", "compound",
     ["Ställ bänken i 30–45 graders lutning.", "Sänk stången mot övre delen av bröstet.", "Pressa upp i en kontrollerad rörelse."]),
    ("hantelpress", "Hantelpress", ["chest"], ["triceps", "shoulders"], "dumbbell", "compound",
     ["Ligg på en plan bänk med en hantel i varje hand.", "Sänk hantlarna kontrollerat till bröstnivå.", "Pressa upp och för hantlarna lätt mot varandra."]),
    ("lutande-hantelpress", "Lutande hantelpress", ["chest"], ["shoulders", "triceps"], "dumbbell", "compound",
     ["Ställ bänken i 30–45 graders lutning.", "Sänk hantlarna mot övre bröstet med armbågarna i cirka 45 grader.", "Pressa upp utan att låsa armbågarna hårt."]),
    ("kabelflyes", "Kabelflyes", ["chest"], ["shoulders"], "cable", "isolation",
     ["Ställ dig mitt emellan kabeltornen med ett handtag i varje hand.", "Håll en lätt böj i armbågarna.", "För ihop händerna framför bröstet i en båge och återgå långsamt."]),
    ("brostpress-maskin", "Bröstpress i maskin", ["chest"], ["triceps", "shoulders"], "machine", "compound",
     ["Justera sitshöjden så att handtagen är i bröstnivå.", "Pressa fram till nästan raka armar.", "Återgå kontrollerat."]),
    ("pec-deck", "Pec deck", ["chest"], [], "machine", "isolation",
     ["Sitt med ryggen mot dynan och armarna mot handtagen.", "För ihop armarna framför kroppen.", "Återgå långsamt tills du känner en stretch i bröstet."]),
    ("armhavningar", "Armhävningar", ["chest"], ["triceps", "shoulders", "core"], "bodyweight", "compound",
     ["Placera händerna något bredare än axelbredd.", "Håll kroppen rak från huvud till häl.", "Sänk bröstet mot golvet och pressa upp igen."]),
    ("dips", "Dips", ["triceps", "chest"], ["shoulders"], "bodyweight", "compound",
     ["Greppa dipsbommarna och lyft upp kroppen på raka armar.", "Sänk kroppen tills överarmarna är ungefär parallella med golvet.", "Pressa upp till startpositionen."]),
    # Rygg
    ("marklyft", "Marklyft", ["lower_back", "glutes", "hamstrings"], ["quads", "traps", "forearms"], "barbell", "compound",
     ["Stå med mitten av foten under stången.", "Greppa stången, sänk höften och spänn ryggen i neutralt läge.", "Lyft genom att trycka ifrån med benen och sträck på höften.", "Sänk stången kontrollerat längs benen."]),
    ("rumansk-marklyft", "Rumänsk marklyft", ["hamstrings", "glutes"], ["lower_back"], "barbell", "compound",
     ["Stå upprätt med stången i händerna.", "För höften bakåt med lätt böjda knän och neutral rygg.", "Sänk stången längs benen tills du känner stretch i baksida lår.", "Sträck på höften för att återgå."]),
    ("chins", "Chins", ["lats"], ["biceps", "upper_back"], "pullup_bar", "compound",
     ["Häng i stången med underhandsgrepp, axelbrett.", "Dra dig upp tills hakan är över stången.", "Sänk dig kontrollerat till raka armar."]),
    ("pullups", "Pull-ups", ["lats"], ["biceps", "upper_back"], "pullup_bar", "compound",
     ["Häng i stången med överhandsgrepp, något bredare än axelbredd.", "Dra bröstet mot stången genom att föra armbågarna nedåt.", "Sänk dig kontrollerat."]),
    ("latsdrag", "Latsdrag", ["lats"], ["biceps", "upper_back"], "cable", "compound",
     ["Sitt med låren under dynan och greppa stången brett.", "Dra stången mot övre bröstet.", "Låt stången gå upp kontrollerat till raka armar."]),
    ("skivstangsrodd", "Skivstångsrodd", ["upper_back", "lats"], ["biceps", "lower_back"], "barbell", "compound",
     ["Fäll fram överkroppen med neutral rygg och lätt böjda knän.", "Dra stången mot naveln.", "Sänk kontrollerat utan att runda ryggen."]),
    ("hantelrodd", "Enarmad hantelrodd", ["lats", "upper_back"], ["biceps"], "dumbbell", "compound",
     ["Stöd ena handen och knät mot en bänk.", "Dra hanteln mot höften med armbågen nära kroppen.", "Sänk kontrollerat och byt sida efter setet."]),
    ("sittande-kabelrodd", "Sittande kabelrodd", ["upper_back", "lats"], ["biceps"], "cable", "compound",
     ["Sitt med fötterna mot stödet och greppa handtaget.", "Dra handtaget mot magen och för ihop skulderbladen.", "Sträck armarna kontrollerat."]),
    ("face-pulls", "Face pulls", ["shoulders", "upper_back"], ["traps"], "cable", "isolation",
     ["Ställ kabeln i ansiktshöjd med ett rep.", "Dra repet mot ansiktet med armbågarna högt.", "Rotera händerna utåt i slutläget och återgå kontrollerat."]),
    ("ryggresningar", "Ryggresningar", ["lower_back"], ["glutes", "hamstrings"], "bodyweight", "isolation",
     ["Placera höften mot dynan i en ryggresningsbänk.", "Sänk överkroppen med neutral rygg.", "Res dig till en rak linje med kroppen."]),
    ("shrugs", "Shrugs", ["traps"], ["forearms"], "dumbbell", "isolation",
     ["Stå med en hantel i varje hand.", "Dra axlarna rakt upp mot öronen.", "Håll en kort stund och sänk kontrollerat."]),
    # Axlar
    ("militarpress", "Stående militärpress", ["shoulders"], ["triceps", "core"], "barbell", "compound",
     ["Stå med stången vilande på främre delen av axlarna.", "Spänn mage och säte.", "Pressa stången rakt upp över huvudet och sänk kontrollerat."]),
    ("axelpress-hantlar", "Sittande axelpress med hantlar", ["shoulders"], ["triceps"], "dumbbell", "compound",
     ["Sitt på en bänk med ryggstöd och hantlarna vid axlarna.", "Pressa upp hantlarna över huvudet.", "Sänk kontrollerat till axelhöjd."]),
    ("arnoldpress", "Arnoldpress", ["shoulders"], ["triceps"], "dumbbell", "compound",
     ["Starta med hantlarna framför axlarna och handflatorna mot dig.", "Rotera handflatorna framåt medan du pressar upp.", "Vänd tillbaka rörelsen på vägen ned."]),
    ("sidolyft", "Sidolyft", ["shoulders"], [], "dumbbell", "isolation",
     ["Stå med en hantel i varje hand längs sidorna.", "Lyft armarna ut åt sidorna till axelhöjd med lätt böjda armbågar.", "Sänk långsamt."]),
    ("sidolyft-kabel", "Sidolyft i kabel", ["shoulders"], [], "cable", "isolation",
     ["Ställ dig bredvid ett lågt kabeltorn och greppa handtaget med den bortre handen.", "Lyft armen ut åt sidan till axelhöjd.", "Sänk kontrollerat."]),
    ("omvanda-flyes", "Omvända flyes", ["shoulders", "upper_back"], [], "dumbbell", "isolation",
     ["Fäll fram överkroppen med neutral rygg.", "Lyft hantlarna ut åt sidorna med lätt böjda armbågar.", "Sänk kontrollerat."]),
    ("band-pull-apart", "Band pull-apart", ["shoulders", "upper_back"], [], "bands", "isolation",
     ["Håll ett gummiband framför dig på raka armar.", "Dra isär bandet mot bröstet genom att föra ihop skulderbladen.", "Återgå kontrollerat."]),
    # Armar
    ("skivstangscurl", "Skivstångscurl", ["biceps"], ["forearms"], "barbell", "isolation",
     ["Stå med stången i underhandsgrepp, axelbrett.", "Böj armarna och lyft stången mot axlarna utan att svinga.", "Sänk kontrollerat."]),
    ("hantelcurl", "Hantelcurl", ["biceps"], ["forearms"], "dumbbell", "isolation",
     ["Stå med en hantel i varje hand.", "Böj armen och rotera handflatan uppåt under lyftet.", "Sänk långsamt."]),
    ("hammarcurl", "Hammarcurl", ["biceps", "forearms"], [], "dumbbell", "isolation",
     ["Håll hantlarna med handflatorna mot kroppen.", "Böj armarna utan att flytta armbågarna.", "Sänk kontrollerat."]),
    ("scottcurl", "Scottcurl", ["biceps"], [], "ez_bar", "isolation",
     ["Sitt vid scottbänken med överarmarna mot dynan.", "Böj armarna och lyft stången.", "Sänk till nästan raka armar."]),
    ("triceps-pushdown", "Triceps pushdown", ["triceps"], [], "cable", "isolation",
     ["Stå vid ett högt kabeltorn med ett rep eller en stång.", "Håll armbågarna mot sidorna.", "Pressa ned till raka armar och återgå kontrollerat."]),
    ("fransk-press", "Fransk press", ["triceps"], [], "ez_bar", "isolation",
     ["Ligg på en bänk med stången på raka armar ovanför bröstet.", "Böj armbågarna och sänk stången mot pannan.", "Sträck armarna igen utan att flytta överarmarna."]),
    ("triceps-over-huvudet", "Triceps över huvudet i kabel", ["triceps"], [], "cable", "isolation",
     ["Vänd ryggen mot ett kabeltorn med repet bakom huvudet.", "Sträck armarna framåt och uppåt.", "Böj armbågarna kontrollerat tillbaka."]),
    ("smal-bankpress", "Smal bänkpress", ["triceps", "chest"], ["shoulders"], "barbell", "compound",
     ["Ligg på bänken och greppa stången med cirka axelbrett grepp.", "Sänk stången mot nedre bröstet med armbågarna nära kroppen.", "Pressa upp."]),
    # Ben
    ("knabojs", "Knäböj", ["quads", "glutes"], ["hamstrings", "core", "lower_back"], "barbell", "compound",
     ["Placera stången på övre delen av ryggen.", "Stå med fötterna cirka axelbrett och tårna lätt utåt.", "Böj i höft och knän tills låren är minst parallella med golvet.", "Pressa upp genom hela foten."]),
    ("frontbo", "Frontböj", ["quads"], ["glutes", "core"], "barbell", "compound",
     ["Vila stången på främre delen av axlarna med armbågarna högt.", "Håll överkroppen upprätt och böj ned.", "Pressa upp genom hela foten."]),
    ("gobletknabojs", "Gobletknäböj", ["quads", "glutes"], ["core"], "dumbbell", "compound",
     ["Håll en hantel eller kettlebell mot bröstet.", "Böj ned med upprätt överkropp mellan knäna.", "Pressa upp till stående."]),
    ("benpress", "Benpress", ["quads", "glutes"], ["hamstrings"], "machine", "compound",
     ["Placera fötterna axelbrett på plattan.", "Sänk plattan kontrollerat utan att svanken släpper dynan.", "Pressa upp utan att låsa knäna hårt."]),
    ("hackbo", "Hackböj", ["quads"], ["glutes"], "machine", "compound",
     ["Ställ dig i maskinen med ryggen mot dynan.", "Böj knäna och sänk dig kontrollerat.", "Pressa upp genom hela foten."]),
    ("utfall-hantlar", "Utfall med hantlar", ["quads", "glutes"], ["hamstrings"], "dumbbell", "compound",
     ["Stå med en hantel i varje hand.", "Ta ett långt kliv framåt och sänk bakre knät mot golvet.", "Tryck ifrån med främre foten och byt ben."]),
    ("bulgarisk-splitbo", "Bulgarisk splitböj", ["quads", "glutes"], ["hamstrings"], "dumbbell", "compound",
     ["Placera bakre foten på en bänk.", "Sänk dig rakt ned med upprätt överkropp.", "Pressa upp genom främre foten."]),
    ("benspark", "Benspark", ["quads"], [], "machine", "isolation",
     ["Sitt i maskinen med dynan mot nedre delen av smalbenen.", "Sträck benen till nästan raka.", "Sänk kontrollerat."]),
    ("liggande-larcurl", "Liggande lårcurl", ["hamstrings"], ["calves"], "machine", "isolation",
     ["Ligg på magen med dynan ovanför hälarna.", "Böj knäna och dra hälarna mot sätet.", "Sänk kontrollerat."]),
    ("sittande-larcurl", "Sittande lårcurl", ["hamstrings"], [], "machine", "isolation",
     ["Sitt i maskinen med dynan bakom smalbenen.", "Böj knäna så långt du kan kontrollerat.", "Återgå långsamt."]),
    ("hip-thrust", "Hip thrust", ["glutes"], ["hamstrings"], "barbell", "compound",
     ["Sitt med övre delen av ryggen mot en bänk och stången över höften.", "Pressa upp höften tills kroppen är rak från axlar till knän.", "Sänk kontrollerat."]),
    ("hoftlyft", "Höftlyft", ["glutes"], ["hamstrings", "core"], "bodyweight", "isolation",
     ["Ligg på rygg med böjda knän och fötterna i golvet.", "Lyft höften genom att spänna sätet.", "Sänk långsamt."]),
    ("kettlebell-swing", "Kettlebellswing", ["glutes", "hamstrings"], ["lower_back", "core"], "kettlebell", "compound",
     ["Stå med kettlebellen framför dig och fäll höften bakåt.", "Svinga klockan mellan benen och sträck explosivt på höften.", "Låt klockan pendla upp till brösthöjd och upprepa."]),
    ("vadpress-staende", "Stående vadpress", ["calves"], [], "machine", "isolation",
     ["Stå med framfoten på kanten och axlarna under dynorna.", "Res dig så högt du kan på tårna.", "Sänk hälarna långsamt under kanten."]),
    ("vadpress-sittande", "Sittande vadpress", ["calves"], [], "machine", "isolation",
     ["Sitt med dynan över knäna och framfoten på plattan.", "Pressa upp hälarna.", "Sänk kontrollerat."]),
    # Bål
    ("planka", "Planka", ["core"], ["shoulders"], "bodyweight", "isolation",
     ["Stöd dig på underarmar och tår.", "Håll kroppen rak från huvud till häl.", "Andas lugnt och håll positionen."]),
    ("hangande-benlyft", "Hängande benlyft", ["core"], ["forearms"], "pullup_bar", "isolation",
     ["Häng i en stång med raka armar.", "Lyft benen framåt och uppåt utan att svinga.", "Sänk kontrollerat."]),
    ("kabelcrunch", "Kabelcrunch", ["core"], [], "cable", "isolation",
     ["Stå på knä framför ett högt kabeltorn med repet vid huvudet.", "Rulla ihop överkroppen mot knäna.", "Återgå kontrollerat."]),
    ("pallof-press", "Pallof press", ["core"], [], "cable", "isolation",
     ["Stå i sidled mot kabeltornet med handtaget mot bröstet.", "Pressa ut handtaget rakt fram utan att rotera.", "För tillbaka handtaget kontrollerat."]),
    ("dead-bug", "Dead bug", ["core"], [], "bodyweight", "isolation",
     ["Ligg på rygg med armar och ben i luften.", "Sträck ut motsatt arm och ben mot golvet med ländryggen i golvet.", "Återgå och byt sida."]),
]


def sql_str(value):
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_arr(values):
    if not values:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_str(v) for v in values) + "]::text[]"


def kcal(p, c, f, fib):
    return round(4 * p + 4 * c + 9 * f + 2 * fib, 1)


def main():
    lines = [
        "-- GENERATED by scripts/generate-starter-data.py - do not edit by hand.",
        "-- Starter reference foods: approximate values, stored as source 'starter_reference' and",
        "-- verification 'estimated'. Energy is computed from macros (EU Atwater factors).",
        "-- Starter exercises have no images: only licensed or user-provided media may be attached.",
        "",
    ]
    note = "Ungefärligt referensvärde för en generisk vara. Kontrollera mot förpackningen eller Livsmedelsverkets livsmedelsdatabas."
    for (name, canonical, cat, prep, p, c, f, fib, allergens, known, diet, servings) in FOODS:
        lines.append(
            "with f as (insert into public.foods (owner_id, name, canonical_name, category, preparation, "
            "kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, allergens, "
            "allergens_known, diet_tags, source, source_note, verification) values ("
            f"null, {sql_str(name)}, {sql_str(canonical)}, '{cat}', '{prep}', {kcal(p, c, f, fib)}, {p}, {c}, {f}, {fib}, "
            f"{sql_arr(allergens)}, {'true' if known else 'false'}, {sql_arr(diet)}, 'starter_reference', {sql_str(note)}, 'estimated'"
            ") returning id)"
        )
        if servings:
            vals = ", ".join(f"({sql_str(label)}, {grams})" for label, grams in servings)
            lines.append(
                f"insert into public.food_servings (food_id, owner_id, label, grams) select f.id, null, v.label, v.grams from f, (values {vals}) as v(label, grams);"
            )
        else:
            lines.append("select 1 from f;")
    lines.append("")
    for (slug, name, primary, secondary, equipment, mech, instructions) in EXERCISES:
        lines.append(
            "insert into public.exercises (owner_id, slug, name, primary_muscles, secondary_muscles, equipment, mechanics, instructions) values ("
            f"null, {sql_str(slug)}, {sql_str(name)}, {sql_arr(primary)}, {sql_arr(secondary)}, {sql_str(equipment)}, {sql_str(mech)}, {sql_arr(instructions)});"
        )
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(FOODS)} foods, {len(EXERCISES)} exercises)")


if __name__ == "__main__":
    main()
