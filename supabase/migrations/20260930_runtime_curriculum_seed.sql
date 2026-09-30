-- Runtime curriculum IDs used by the app's seed data.
-- Curriculum metadata only; no parent/student PII or secrets.

insert into public.subjects (name, description, class, board, icon, active, display_order, legacy_id)
select v.name, v.description, '5', 'CBSE', v.icon, true, v.display_order, v.legacy_id
from (values
 ('Mathematics','Numbers, shapes, angles, fractions, and foundational mathematical logic.','Calculator',1,'sub_maths'),
 ('Science (EVS)','Living organisms, natural phenomena, environment, senses, and habitats.','FlaskConical',2,'sub_science'),
 ('English','Literature, reading comprehension, grammar, vocabulary, and creative writing.','BookOpen',3,'sub_english'),
 ('Hindi','Hindi prose, poetry, grammar (Vyakaran), and comprehension stories.','Languages',4,'sub_hindi'),
 ('Malayalam','Regional language literature, poems, Malayalam grammar, and cultural stories.','GraduationCap',5,'sub_malayalam'),
 ('Social Science','Our earth, geography, history, heritage, governance, and community life.','Compass',6,'sub_social')
) v(name,description,icon,display_order,legacy_id)
where not exists (select 1 from public.subjects s where s.legacy_id=v.legacy_id);

insert into public.chapters (subject_id,chapter_number,chapter_name,description,active,display_order,legacy_id)
select s.id,v.chapter_number,v.chapter_name,v.description,true,v.chapter_number,v.legacy_id
from (values
 ('sub_maths',1,'The Fish Tale','Sample CBSE Chapter: Large numbers, place value, fish market calculations, speed and distance.','chap_math_1'),
 ('sub_maths',2,'Shapes and Angles','Sample CBSE Chapter: Acute, obtuse, right angles, clock angles, and geometric shapes.','chap_math_2'),
 ('sub_maths',3,'How Many Squares?','Sample CBSE Chapter: Calculating area and perimeter using square grids and stamp puzzles.','chap_math_3'),
 ('sub_maths',4,'Parts and Wholes','Sample CBSE Chapter: Fractions, equal parts, chocolate division, and flag patterns.','chap_math_4'),
 ('sub_science',1,'Super Senses','Sample CBSE Chapter: Amazing senses of sight, smell, hearing in ants, birds, and dogs.','chap_sci_1'),
 ('sub_science',2,'A Snake Charmer''s Story','Sample CBSE Chapter: Snakes, snake venom, instruments, and wildlife protection.','chap_sci_2'),
 ('sub_science',3,'From Tasting to Digesting','Sample CBSE Chapter: Tongue taste buds, digestion journey, glucose drip, and balanced diet.','chap_sci_3'),
 ('sub_science',4,'Mangoes Round the Year','Sample CBSE Chapter: Food spoilage, preservation, Mamidi Tandra (aam papad) preparation.','chap_sci_4'),
 ('sub_english',1,'Ice-Cream Man','Sample CBSE Chapter: Summer poem, rhyme scheme, cold carts, joyful summer treats.','chap_eng_1'),
 ('sub_english',2,'Wonderful Waste!','Sample CBSE Chapter: Folktale of Travancore Maharaja and the invention of Avial from vegetable scraps.','chap_eng_2'),
 ('sub_english',3,'Teamwork','Sample CBSE Chapter: Collaborative spirit, passing the baton, together achieving dreams.','chap_eng_3'),
 ('sub_hindi',1,'Raakh Ki Rassi (राख की रस्सी)','Sample CBSE Chapter: Tibetan folktale about Lonpo Gar and his clever daughter-in-law.','chap_hin_1'),
 ('sub_hindi',2,'Faslon Ke Tyohar (फ़सलों के त्यौहार)','Sample CBSE Chapter: Harvest celebrations across India - Makar Sankranti, Pongal, Bihu, Sarhul.','chap_hin_2'),
 ('sub_malayalam',1,'Nanmayude Pookkal (നന്മയുടെ പൂക്കൾ)','Sample CBSE Chapter: Moral values, respect, kindness and empathy through poetic prose.','chap_mal_1'),
 ('sub_malayalam',2,'Kuttikalam (കുട്ടിക്കാലം)','Sample CBSE Chapter: Childhood memories, village nature, play and learning in Kerala.','chap_mal_2'),
 ('sub_social',1,'Globe and Maps','Sample CBSE Chapter: Latitudes, longitudes, scales, directions, and reading physical symbols.','chap_soc_1'),
 ('sub_social',2,'The Northern Mountains','Sample CBSE Chapter: The Himalayas, Himadri, Himachal, Shivalik, climate and people.','chap_soc_2'),
 ('sub_social',3,'The Northern Plains','Sample CBSE Chapter: Ganga, Indus, Brahmaputra basins, fertile soil and agriculture.','chap_soc_3')
) v(subject_legacy_id,chapter_number,chapter_name,description,legacy_id)
join public.subjects s on s.legacy_id=v.subject_legacy_id
where not exists (select 1 from public.chapters c where c.legacy_id=v.legacy_id);