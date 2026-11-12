// Clinical Anatomical Ontology & Trilingual Nomenclature
// Standards: Foundational Model of Anatomy (FMA), SNOMED CT, Nomina Anatomica (Latin)
// Languages: Thai (TH) / English (EN) / Latin (LA) with Clinical Significance & Function

export const ANATOMY_DICT = {
  // ==================== CRANIOMAXILLOFACIAL (กะโหลกและใบหน้า) ====================
  "Frontal bone": {
    th: "กระดูกหน้าผาก",
    en: "Frontal bone",
    la: "Os frontale",
    fma: "FMA:52734",
    snomed: "87877006",
    system: "Skeletal (Neurocranium)",
    desc: "สร้างส่วนโค้งหน้าผาก ขอบเบ้าตาด้านบน และโพรงอากาศหน้าผาก (Frontal sinus) ป้องกันสมองกลีบหน้า",
    clinical: "เสี่ยงต่อการแตกแบบยุบตัว (Depressed fracture) จากอุบัติเหตุศีรษะกระแทก อาจทำให้เกิดโพรงอากาศอักเสบ"
  },
  "Parietal bone": {
    th: "กระดูกข้างขม่อม",
    en: "Parietal bone",
    la: "Os parietale",
    fma: "FMA:52735",
    snomed: "54242006",
    system: "Skeletal (Neurocranium)",
    desc: "กระดูกแบนคู่ประกอบกันเป็นหลังคาของกะโหลกศีรษะ เชื่อมกันด้วยรอยต่อ Sagittal suture",
    clinical: "เชื่อมกับ Coronal suture หากเชื่อมปิดก่อนวัยในทารก (Craniosynostosis) จะทำให้กะโหลกผิดรูป"
  },
  "Temporal bone": {
    th: "กระดูกขมับ",
    en: "Temporal bone",
    la: "Os temporale",
    fma: "FMA:52736",
    snomed: "60911003",
    system: "Skeletal (Neurocranium)",
    desc: "บรรจุอวัยวะรับการได้ยินและการทรงตัว (Cochlea & Vestibular apparatus) มีช่องเปิดหูภายนอก",
    clinical: "กระดูกบริเวณ Pterion บางมาก หากแตกจะฉีกขาดเส้นเลือด Middle meningeal artery เกิด Epidural Hematoma (EDH)"
  },
  "Occipital bone": {
    th: "กระดูกท้ายทอย",
    en: "Occipital bone",
    la: "Os occipitale",
    fma: "FMA:52737",
    snomed: "31640002",
    system: "Skeletal (Neurocranium)",
    desc: "ฐานกะโหลกด้านหลัง มีรูเปิดขนาดใหญ่ Foramen magnum ให้ก้านสมองและไขสันหลังผ่าน",
    clinical: "จุดเชื่อมต่อกับกระดูกคอ C1 (Atlas) ผ่าน Occipital condyles ภาวะความดันในกะโหลกสูงอาจทำให้สมองน้อยเคลื่อนลงมากดทับ (Tonsillar herniation)"
  },
  "Nasal bone": {
    th: "กระดูกสันจมูก",
    en: "Nasal bone",
    la: "Os nasale",
    fma: "FMA:52741",
    snomed: "21114002",
    system: "Skeletal (Viscerocranium)",
    desc: "กระดูกคู่ขนาดเล็กเชื่อมต่อกันตรงกลางเพื่อสร้างสันจมูกแข็ง",
    clinical: "เป็นกระดูกใบหน้าที่เกิดการแตกหักบ่อยที่สุด (Most common facial fracture) มักพบร่วมกับเลือดกำเดาไหล (Epistaxis)"
  },
  "Zygomatic bone (cheekbone)": {
    th: "กระดูกโหนกแก้ม",
    en: "Zygomatic bone",
    la: "Os zygomaticum",
    fma: "FMA:52744",
    snomed: "13881006",
    system: "Skeletal (Viscerocranium)",
    desc: "กระดูกโหนกแก้ม สร้างขอบล่างและด้านข้างของเบ้าตา เชื่อมต่อกับ Zygomatic arch",
    clinical: "การบาดเจ็บแรงกระแทกอาจเกิด Tripod fracture (Zygomaticomaxillary complex fracture) ทำให้การอ้าปากจำกัด"
  },
  "Maxilla (upper jaw)": {
    th: "กระดูกขากรรไกรบน",
    en: "Maxilla (Upper jaw)",
    la: "Maxilla",
    fma: "FMA:52743",
    snomed: "51283005",
    system: "Skeletal (Viscerocranium)",
    desc: "กระดูกขากรรไกรบน ยึดฟันบนและสร้างเพดานปากแข็ง (Hard palate) พร้อมโพรงไซนัสแม็กซิลลารี",
    clinical: "การแตกหักตามแนว Le Fort I, II, III เป็นเกณฑ์ประเมินการบาดเจ็บกะโหลกใบหน้าขั้นวิกฤต"
  },
  "Teeth": {
    th: "ฟันแท้",
    en: "Permanent Teeth",
    la: "Dentes permanentes",
    fma: "FMA:12516",
    snomed: "38199008",
    system: "Digestive & Skeletal",
    desc: "อวัยวะแข็งฝังในเบ้ากระดูกขากรรไกร มีเคลือบฟัน (Enamel) ที่แข็งที่สุดในร่างกายเพื่อบดเคี้ยวอาหาร",
    clinical: "ใช้ตรวจประเมินระยะสบฟัน (Occlusion), การสึกกร่อน (Attrition) จากนอนกัดฟัน, และการติดเชื้อปลายรากฟัน"
  },
  "Mandible (lower jaw)": {
    th: "กระดูกขากรรไกรล่าง",
    en: "Mandible (Lower jaw)",
    la: "Mandibula",
    fma: "FMA:52748",
    snomed: "91609006",
    system: "Skeletal (Viscerocranium)",
    desc: "กระดูกชิ้นเดียวที่เคลื่อนไหวได้ของกะโหลกศีรษะ เชื่อมกับกระดูกขมับเป็นข้อต่อ TMJ",
    clinical: "มักเกิดการหักที่บริเวณ Condylar neck, Angle หรือ Parasymphysis จากแรงกระแทกคาง"
  },
  "Eyeball": {
    th: "ลูกตาและเบ้าตา",
    en: "Eyeball & Orbit",
    la: "Bulbus oculi",
    fma: "FMA:50746",
    snomed: "81745001",
    system: "Sensory System",
    desc: "อวัยวะรับภาพ ประกอบด้วยกระจกตา (Cornea), เลนส์แก้วตา, และจอประสาทตา (Retina)",
    clinical: "Blow-out fracture ของพื้นเบ้าตาอาจทำให้กล้ามเนื้อ Inferior rectus ติดขัด มองเห็นภาพซ้อน (Diplopia)"
  },

  // ==================== NEUROANATOMY (สมองและประสาท) ====================
  "Frontal lobe": {
    th: "สมองกลีบหน้า",
    en: "Frontal lobe",
    la: "Lobus frontalis",
    fma: "FMA:61824",
    snomed: "78277001",
    system: "Central Nervous System",
    desc: "ควบคุมการสั่งการกล้ามเนื้อ (Primary motor cortex), การตัดสินใจ, พฤติกรรม, และศูนย์ภาษา Broca",
    clinical: "การบาดเจ็บกระทบกระเทือน (TBI) อาจทำให้สูญเสียการยับยั้งชั่งใจ (Disinhibition) หรือเกิด Broca's aphasia"
  },
  "Parietal lobe": {
    th: "สมองกลีบข้าง",
    en: "Parietal lobe",
    la: "Lobus parietalis",
    fma: "FMA:61825",
    snomed: "41938006",
    system: "Central Nervous System",
    desc: "ประมวลผลความรู้สึกกาย (Somatosensory cortex), การรับรู้มิติสัมพันธ์ (Spatial orientation), และการคำนวณ",
    clinical: "รอยโรคในข้างไม่เด่นอาจทำให้เกิดภาวะละเลยร่างกายซีกตรงข้าม (Hemispatial neglect)"
  },
  "Temporal lobe": {
    th: "สมองกลีบขมับ",
    en: "Temporal lobe",
    la: "Lobus temporalis",
    fma: "FMA:61826",
    snomed: "7844006",
    system: "Central Nervous System",
    desc: "ศูนย์การได้ยินปฐมภูมิ, ความจำระยะยาว (Hippocampus), และศูนย์ความเข้าใจภาษา Wernicke",
    clinical: "พยาธิสภาพส่งผลให้เกิดความจำเสื่อม หรือสูญเสียความเข้าใจภาษา (Wernicke's aphasia) และลมชักกลีบขมับ"
  },
  "Occipital lobe": {
    th: "สมองกลีบท้ายทอย",
    en: "Occipital lobe",
    la: "Lobus occipitalis",
    fma: "FMA:61827",
    snomed: "31065005",
    system: "Central Nervous System",
    desc: "ศูนย์การประมวลผลภาพและการมองเห็น (Primary visual cortex V1 / Brodmann area 17)",
    clinical: "รอยโรคขาดเลือดจากหลอดเลือด Posterior cerebral artery (PCA) นำไปสู่อาการลานสายตาดับครึ่งซีก (Homonymous hemianopia)"
  },
  "Cerebral gyri & sulci": {
    th: "รอยหยักและร่องเปลือกสมอง",
    en: "Cerebral gyri & sulci",
    la: "Gyri et sulci cerebri",
    fma: "FMA:62429",
    snomed: "279314002",
    system: "Central Nervous System",
    desc: "การพับม้วนตัวเพิ่มพื้นที่ผิวของเปลือกสมอง (Neocortex) บรรจุเซลล์ประสาทกว่า 16,000 ล้านเซลล์สำหรับสติปัญญาและการคิดขั้นสูง",
    clinical: "ภาวะ Lissencephaly (สมองเรียบไร้รอยหยัก) เป็นความผิดปกติแต่กำเนิดที่นำไปสู่พัฒนาการช้าและโรคลมชักรุนแรง"
  },
  "Digital Neural Connectome": {
    th: "สมองดิจิทัลและการเรียนรู้เชิงลึก",
    en: "Digital Neural AI Connectome",
    la: "Connectoma neuralis digitalis",
    fma: "FMA:83648",
    snomed: "AI-NEURAL-01",
    system: "Digital Neuro-AI",
    desc: "แบบจำลองโครงข่ายประสาทเทียมเชิงลึก (Deep Learning Artificial Neural Network) ถอดรหัสคลื่นสมองและการอนุมานภาพแบบเรียลไทม์",
    clinical: "การผสาน Brain-Computer Interface (BCI) และโครงข่ายประสาทสังเคราะห์ช่วยฟื้นฟูการสั่งการและการสื่อสารของผู้ป่วยอัมพาต"
  },
  "Cerebellum": {
    th: "สมองน้อย",
    en: "Cerebellum",
    la: "Cerebellum",
    fma: "FMA:67944",
    snomed: "113305005",
    system: "Central Nervous System",
    desc: "ประสานพิกัดการทำงานของกล้ามเนื้อลาย ความแม่นยำในการเคลื่อนไหว และการทรงตัว",
    clinical: "ความผิดปกติทำให้เกิด Ataxia (เดินเซ), Dysmetria (กะระยะผิดพลาด), และ Intention tremor"
  },
  "Pons (brainstem)": {
    th: "พอนส์ (ก้านสมอง)",
    en: "Pons",
    la: "Pons",
    fma: "FMA:67943",
    snomed: "2748008",
    system: "Brainstem",
    desc: "ทางผ่านของเส้นประสาทสมองคู่ที่ V, VI, VII, VIII และศูนย์ควบคุมจังหวะการหายใจ Pneumotaxic center",
    clinical: "หลอดเลือด Basilar artery อุดตันอาจทำให้เกิดภาวะ Locked-in syndrome"
  },
  "Medulla oblongata": {
    th: "ก้านสมองส่วนท้าย",
    en: "Medulla oblongata",
    la: "Medulla oblongata",
    fma: "FMA:67942",
    snomed: "30598007",
    system: "Brainstem",
    desc: "ศูนย์ควบคุมสัญญาณชีพขั้นพื้นฐาน ได้แก่ การหายใจ, อัตราการเต้นหัวใจ, และความดันโลหิต",
    clinical: "รอยโรคขาดเลือด Lateral medullary syndrome (Wallenberg syndrome) เกิดจากหลอดเลือด PICA ตีบ"
  },

  // ==================== FACIAL MUSCLES (กล้ามเนื้อใบหน้า) ====================
  "Frontalis": {
    th: "กล้ามเนื้อหน้าผาก",
    en: "Frontalis muscle",
    la: "Venter frontalis musculi occipitofrontalis",
    fma: "FMA:46757",
    snomed: "40146001",
    system: "Muscular",
    desc: "ยกคิ้วและย่นหน้าผาก เลี้ยงโดยเส้นประสาทสมองคู่ที่ VII (Facial nerve - temporal branch)",
    clinical: "ใช้ทดสอบแยก Bell's palsy (อัมพาตครึ่งซีกทั้งหน้าผาก) จาก Stroke (หน้าผากยังย่นได้เนื่องจากมี dual hemispheric innervation)"
  },
  "Temporalis": {
    th: "กล้ามเนื้อขมับ",
    en: "Temporalis muscle",
    la: "Musculus temporalis",
    fma: "FMA:49006",
    snomed: "34202007",
    system: "Masticatory",
    desc: "กล้ามเนื้อรูปพัดทำหน้าที่ยกขากรรไกรล่างขึ้นและดึงถอยหลัง เลี้ยงโดยเส้นประสาทคู่ที่ V3",
    clinical: "มักเกิดอาการปวดตึงในกลุ่ม Tension-type headache หรือโรคข้อต่อขากรรไกร TMJ dysfunction"
  },
  "Orbicularis oculi": {
    th: "กล้ามเนื้อรอบเบ้าตา",
    en: "Orbicularis oculi muscle",
    la: "Musculus orbicularis oculi",
    fma: "FMA:46779",
    snomed: "24480005",
    system: "Muscular",
    desc: "กล้ามเนื้อหูรูดรอบเบ้าตา ทำหน้าที่กะพริบตาและปิดเปลือกตาสนิทเพื่อปกป้องกระจกตา",
    clinical: "หากกล้ามเนื้ออ่อนแรงจาก Facial nerve palsy จะหลับตาไม่สนิท (Lagophthalmos) เสี่ยงกระจกตาแห้งเป็นแผล"
  },
  "Nasalis": {
    th: "กล้ามเนื้อปีกจมูก",
    en: "Nasalis muscle",
    la: "Musculus nasalis",
    fma: "FMA:46770",
    snomed: "60746007",
    system: "Muscular",
    desc: "บีบและขยายรูจมูกในการหายใจเข้าลึก",
    clinical: "Nasal flaring (ปีกจมูกบาน) ในเด็กเป็นสัญญาณทางกายภาพของภาวะหายใจลำบาก (Respiratory distress)"
  },
  "Zygomaticus major": {
    th: "กล้ามเนื้อโหนกแก้มใหญ่",
    en: "Zygomaticus major muscle",
    la: "Musculus zygomaticus major",
    fma: "FMA:46816",
    snomed: "76670001",
    system: "Muscular",
    desc: "ดึงมุมปากขึ้นบนและไปทางด้านข้างเพื่อแสดงสีหน้ายิ้มแย้ม",
    clinical: "ใช้ตรวจความสมมาตรของรอยยิ้มในการคัดกรองโรคหลอดเลือดสมอง (FAST protocol: Face drooping)"
  },
  "Masseter": {
    th: "กล้ามเนื้อบดเคี้ยวแมสซีเตอร์",
    en: "Masseter muscle",
    la: "Musculus masseter",
    fma: "FMA:49005",
    snomed: "79172004",
    system: "Masticatory",
    desc: "กล้ามเนื้อบดเคี้ยวที่ทรงพลังที่สุดในการสบฟันแน่น เลี้ยงโดย Mandibular nerve (CN V3)",
    clinical: "ภาวะนอนกัดฟัน (Bruxism) ทำให้กล้ามเนื้อมัดนี้โตหนาตัว (Masseteric hypertrophy) หรือปวดตึงเรื้อรัง"
  },
  "Orbicularis oris": {
    th: "กล้ามเนื้อรอบริมฝีปาก",
    en: "Orbicularis oris muscle",
    la: "Musculus orbicularis oris",
    fma: "FMA:46835",
    snomed: "85287009",
    system: "Muscular",
    desc: "กล้ามเนื้อหูรูดรอบริมฝีปาก ใช้ในการหุบปาก ผิวปาก และออกเสียงพยัญชนะริมฝีปาก",
    clinical: "อ่อนแรงทำให้น้ำลายไหลมุมปาก (Drooling) และรับประทานอาหารหกเลอะเทอะ"
  },
  "Depressor anguli oris": {
    th: "กล้ามเนื้อมุมปากตก",
    en: "Depressor anguli oris muscle",
    la: "Musculus depressor anguli oris",
    fma: "FMA:46824",
    snomed: "72179007",
    system: "Muscular",
    desc: "ดึงมุมปากลงด้านล่างเพื่อแสดงอารมณ์เศร้าหรือบึ้งตึง",
    clinical: "ใช้ประเมินความสมดุลของการเคลื่อนไหวมุมปากล่าง"
  },
  "Mentalis": {
    th: "กล้ามเนื้อคาง",
    en: "Mentalis muscle",
    la: "Musculus mentalis",
    fma: "FMA:46828",
    snomed: "74080004",
    system: "Muscular",
    desc: "ยกและย่นผิวหนังบริเวณคาง พร้อมดันริมฝีปากล่างขึ้น",
    clinical: "รอยบุ๋มและริ้วรอยคางส้ม (Peau d'orange chin) รักษาได้ด้วย Botulinum toxin"
  },

  // ==================== THORAX & VISCERA (ทรวงอกและอวัยวะภายใน) ====================
  "Rib cage": {
    th: "กระดูกซี่โครง 12 คู่",
    en: "Rib cage (Costae)",
    la: "Cavea thoracis / Costae",
    fma: "FMA:7478",
    snomed: "113197003",
    system: "Skeletal (Thorax)",
    desc: "ซี่โครงแท้คู่ที่ 1-7 (True ribs), ซี่โครงไม่แท้ 8-10 (False ribs), และซี่โครงลอย 11-12 (Floating ribs) ปกป้องหัวใจและปอด",
    clinical: "กระดูกซี่โครงหักหลายซี่ตั้งแต่ 2 ตำแหน่งขึ้นไป ทำให้ผนังอกยุบไม่สัมพันธ์กับการหายใจ (Flail chest)"
  },
  "Sternum": {
    th: "กระดูกสันอก",
    en: "Sternum (Breastbone)",
    la: "Sternum",
    fma: "FMA:7485",
    snomed: "56873002",
    system: "Skeletal (Thorax)",
    desc: "ประกอบด้วย Manubrium, Body, และ Xiphoid process มีรอยต่อ Sternal angle (Angle of Louis) ที่ระดับซี่โครงคู่ที่ 2",
    clinical: "จุดอ้างอิงสำคัญในการกดหน้าอกกู้ชีพ (CPR) และใช้เจาะตรวจไขกระดูก (Bone marrow aspiration)"
  },
  "Thoracic spine": {
    th: "กระดูกสันหลังส่วนอก (T1-T12)",
    en: "Thoracic spine",
    la: "Vertebrae thoracicae",
    fma: "FMA:9139",
    snomed: "122495006",
    system: "Skeletal (Spine)",
    desc: "กระดูกสันหลัง 12 ปล้อง มีรอยเชื่อมต่อกับหัวกระดูกซี่โครง (Costal facets) โค้งแบบ Kyphosis",
    clinical: "จุดเกิดโรคกระดูกสันหลังคด (Thoracic scoliosis) และกระดูกหักยุบจากโรคกระดูกพรุน (Osteoporotic compression fracture)"
  },
  "Clavicle": {
    th: "กระดูกไหปลาร้า",
    en: "Clavicle (Collarbone)",
    la: "Clavicula",
    fma: "FMA:13321",
    snomed: "51299004",
    system: "Skeletal (Shoulder girdle)",
    desc: "กระดูกรูปตัว S ค้ำยันระยางค์แขนออกจากทรวงอก เชื่อมกับกระดูกสันอกและข้อไหล่ Acromion",
    clinical: "หักบ่อยที่สุดที่รอยต่อ 1/3 กลางและนอก (Middle 1/3 fracture) จากอุบัติเหตุล้มมือยันพื้น"
  },
  "Costal Cartilage": {
    th: "กระดูกอ่อนซี่โครงไฮยาไลน์",
    en: "Costal Cartilage",
    la: "Cartilago costalis",
    fma: "FMA:7484",
    snomed: "87042004",
    system: "Skeletal (Cartilage)",
    desc: "กระดูกอ่อนไฮยาไลน์ยืดหยุ่นสูง ช่วยให้ทรวงอกขยายตัวตามกลไก Pump-handle และ Bucket-handle ขณะหายใจ",
    clinical: "การอักเสบของกระดูกอ่อนซี่โครง (Costochondritis) มักทำให้เจ็บแน่นหน้าอกคล้ายโรคหัวใจขาดเลือด"
  },

  // ==================== CARDIOVASCULAR (ระบบหัวใจและหลอดเลือด) ====================
  "Beating Heart": {
    th: "หัวใจ 4 ห้อง (เต้นบิดเกลียวเสมือนจริง)",
    en: "4-Chamber Heart",
    la: "Cor",
    fma: "FMA:7088",
    snomed: "80891009",
    system: "Cardiovascular",
    desc: "กล้ามเนื้อหัวใจบีบตัวสูบฉีดเลือดด้วยกลไกเกลียว (Helical apex twist) เลือดดำเข้าห้องขวา เลือดแดงส่งจากห้องซ้าย",
    clinical: "ประเมินสมรรถภาพด้วย Ejection Fraction (EF ปกติ 55-70%) ภาวะกล้ามเนื้อหัวใจขาดเลือดเกิดจาก Coronary artery disease"
  },
  "Left Ventricle": {
    th: "หัวใจห้องล่างซ้าย",
    en: "Left Ventricle",
    la: "Ventriculus sinister cordis",
    fma: "FMA:7101",
    snomed: "87878001",
    system: "Cardiovascular",
    desc: "ผนังกล้ามเนื้อหนาที่สุดเพื่อสร้างแรงดันดันเลือดแดงเข้าสู่ระบบไหลเวียนทั่วร่างกาย",
    clinical: "ภาวะความดันโลหิตสูงเรื้อรังทำให้เกิดกล้ามเนื้อหัวใจห้องล่างซ้ายหนาตัว (Left Ventricular Hypertrophy - LVH)"
  },
  "Right Ventricle": {
    th: "หัวใจห้องล่างขวา",
    en: "Right Ventricle",
    la: "Ventriculus dexter cordis",
    fma: "FMA:7098",
    snomed: "53085002",
    system: "Cardiovascular",
    desc: "สูบฉีดเลือดดำที่มีออกซิเจนต่ำเข้าสู่หลอดเลือดพัลโมนารีไปยังปอดด้วยแรงดันต่ำ",
    clinical: "ความดันหลอดเลือดปอดสูง (Pulmonary hypertension) ส่งผลให้เกิด Right heart failure (Cor pulmonale)"
  },
  "Aorta Arch": {
    th: "ส่วนโค้งหลอดเลือดแดงใหญ่เอออร์ตา",
    en: "Aortic Arch",
    la: "Arcus aortae",
    fma: "FMA:3768",
    snomed: "57034009",
    system: "Cardiovascular",
    desc: "ท่อเลือดแดงใหญ่โค้งเหนือขั้วหัวใจ ให้แขนงหลัก 3 เส้น: Brachiocephalic trunk, Left common carotid, และ Left subclavian",
    clinical: "อันตรายถึงชีวิตหากเกิดหลอดเลือดแดงใหญ่ฉีกขาดเซาะ (Aortic dissection Stanford type A)"
  },
  "Coronary Arteries": {
    th: "หลอดเลือดโคโรนารีเลี้ยงหัวใจ",
    en: "Coronary Arteries (LAD & RCA)",
    la: "Arteriae coronariae",
    fma: "FMA:3780",
    snomed: "41801008",
    system: "Cardiovascular",
    desc: "หลอดเลือดแขนงแรกจากโคนเอออร์ตา แยกเป็น Left Anterior Descending (LAD) และ Right Coronary Artery (RCA)",
    clinical: "เส้นเลือด LAD ตีบตันถูกเรียกว่า 'Widow maker' ทำให้เกิดกล้ามเนื้อหัวใจตายเฉียบพลัน (STEMI)"
  },

  // ==================== RESPIRATORY (ระบบทางเดินหายใจและปอด) ====================
  "Right Lung": {
    th: "ปอดขวา (3 พู)",
    en: "Right Lung",
    la: "Pulmo dexter",
    fma: "FMA:7339",
    snomed: "39607008",
    system: "Respiratory",
    desc: "ปอดข้างขวามีขนาดใหญ่กว่า มี 3 กลีบ (Superior, Middle, Inferior) คั่นด้วย Horizontal และ Oblique fissures",
    clinical: "สิ่งแปลกปลอมสำลักมักตกลงสู่หลอดลมปอดขวา (Right main bronchus) เนื่องจากมุมชันและกว้างกว่า"
  },
  "Left Lung": {
    th: "ปอดซ้าย (2 พู พร้อมรอยเว้ารับหัวใจ)",
    en: "Left Lung",
    la: "Pulmo sinister",
    fma: "FMA:7340",
    snomed: "44714003",
    system: "Respiratory",
    desc: "ปอดข้างซ้ายมี 2 กลีบ (Superior & Inferior) มีรอยเว้า Cardiac notch และแง่ลิ้น Lingula เพื่อเปิดพื้นที่ให้ยอดหัวใจ",
    clinical: "ฟังเสียงปอดเพื่อตรวจประเมินภาวะน้ำในเยื่อหุ้มปอด (Pleural effusion) หรือปอดแฟบ (Atelectasis)"
  },

  // ==================== APPENDICULAR SKELETON (กระดูกระยางค์แขนขา) ====================
  "Humerus": {
    th: "กระดูกต้นแขน",
    en: "Humerus",
    la: "Humerus",
    fma: "FMA:13303",
    snomed: "85050009",
    system: "Skeletal (Upper limb)",
    desc: "กระดูกยาวของต้นแขน เชื่อมกับกระดูกสะบักที่ข้อไหล่ Glenohumeral joint",
    clinical: "การหักบริเวณกึ่งกลางกระดูก (Midshaft fracture) เสี่ยงต่อการบาดเจ็บต่อเส้นประสาท Radial nerve ทำให้ข้อมือตก (Wrist drop)"
  },
  "Radius & Ulna": {
    th: "กระดูกปลายแขนคู่",
    en: "Radius & Ulna (Forearm)",
    la: "Antebrachium (Radius et Ulna)",
    fma: "FMA:9665",
    snomed: "287680003",
    system: "Skeletal (Upper limb)",
    desc: "Radius หมุนรอบ Ulna ในการคว่ำ-หงายมือ (Pronation/Supination)",
    clinical: "กระดูกปลายแขนหักพบบ่อยที่สุดคือ Colles' fracture จากการล้มมือยันพื้นในผู้สูงอายุ"
  },
  "Carpal bones (wrist)": {
    th: "กระดูกข้อมือ 8 ชิ้น",
    en: "Carpal bones",
    la: "Ossa carpi",
    fma: "FMA:23883",
    snomed: "74067007",
    system: "Skeletal (Hand)",
    desc: "เรียง 2 แถว (Scaphoid, Lunate, Triquetrum, Pisiform / Trapezium, Trapezoid, Capitate, Hamate)",
    clinical: "Scaphoid หักบ่อยที่สุด มักเกิดเลือดไปเลี้ยงไม่พอจนหัวกระดูกตาย (Avascular necrosis)"
  },
  "Metacarpal": {
    th: "กระดูกฝ่ามือ",
    en: "Metacarpal bones (I-V)",
    la: "Ossa metacarpalia",
    fma: "FMA:23899",
    snomed: "84724002",
    system: "Skeletal (Hand)",
    desc: "กระดูกท่อนยาว 5 ชิ้นเชื่อมจากข้อมือไปยังนิ้วมือ",
    clinical: "Boxer's fracture คือการหักที่คอกระดูก Metacarpal ชิ้นที่ 5 จากการชกของแข็ง"
  },
  "Proximal phalanx": {
    th: "กระดูกข้อนิ้วโคน",
    en: "Proximal phalanx",
    la: "Phalanx proximalis",
    fma: "FMA:23910",
    snomed: "53840001",
    system: "Skeletal (Hand)",
    desc: "กระดูกข้อนิ้วชิ้นแรกที่ต่อจากกระดูกฝ่ามือ",
    clinical: "ข้อต่อ Metacarpophalangeal (MCP) มักเกิดการอักเสบผิดรูปในโรครูมาตอยด์ (Rheumatoid arthritis)"
  },
  "Middle phalanx": {
    th: "กระดูกข้อนิ้วกลาง",
    en: "Middle phalanx",
    la: "Phalanx media",
    fma: "FMA:23911",
    snomed: "22097003",
    system: "Skeletal (Hand)",
    desc: "กระดูกข้อนิ้วชิ้นกลาง (พบนิ้วชี้ถึงนิ้วก้อย นิ้วหัวแม่มือไม่มี)",
    clinical: "การฉีกขาดของเอ็นเหยียดนิ้วที่ข้อ PIP นำไปสู่ความผิดรูป Boutonnière deformity"
  },
  "Distal phalanx": {
    th: "กระดูกข้อนิ้วปลาย",
    en: "Distal phalanx",
    la: "Phalanx distalis",
    fma: "FMA:23912",
    snomed: "79166006",
    system: "Skeletal (Hand)",
    desc: "กระดูกชิ้นปลายสุดรองรับเล็บมือและปลายนิ้วสัมผัสละเอียด",
    clinical: "เอ็นเหยียดหลุดจากกระดูกนิ้วปลายทำให้เกิดภาวะนิ้วตกกระดกไม่ขึ้น (Mallet finger)"
  },
  "Lumbar spine": {
    th: "กระดูกสันหลังส่วนเอว (L1-L5)",
    en: "Lumbar spine",
    la: "Vertebrae lumbales",
    fma: "FMA:9140",
    snomed: "122496007",
    system: "Skeletal (Spine)",
    desc: "ลำตัวกระดูกมีขนาดใหญ่ที่สุดเพื่อรับน้ำหนักร่างกายท่อนบน โค้งแบบ Lordosis",
    clinical: "หมอนรองกระดูกสันหลัง L4-L5 และ L5-S1 ปลิ้นกดทับเส้นประสาทไซอาติก (Herniated Nucleus Pulposus - HNP / Sciatica)"
  },
  "Pelvic girdle": {
    th: "กระดูกเชิงกรานและกระเบนเหน็บ",
    en: "Pelvic Girdle & Sacrum",
    la: "Pelvis / Cingulum pelvicum",
    fma: "FMA:16580",
    snomed: "272674007",
    system: "Skeletal (Pelvis)",
    desc: "ประกอบด้วยกระดูกสะโพก 2 ข้าง (Ilium, Ischium, Pubis) และ Sacrum ปกป้องอวัยวะสืบพันธุ์และทางเดินปัสสาวะ",
    clinical: "กระดูกเชิงกรานหักแบบ Open-book fracture เสี่ยงต่อการตกเลือดภายในช่องท้องขั้นวิกฤต"
  },
  "Femur": {
    th: "กระดูกต้นขา",
    en: "Femur",
    la: "Femur",
    fma: "FMA:9611",
    snomed: "71341001",
    system: "Skeletal (Lower limb)",
    desc: "กระดูกชิ้นที่ยาวและแข็งแรงที่สุดในร่างกายมนุษย์ มีส่วนคอดอก Femoral neck",
    clinical: "Femoral neck fracture พบบ่อยในผู้สูงอายุที่หกล้ม เสี่ยงต่อ Avascular necrosis ของหัวกระดูกต้นขา"
  },
  "Patella": {
    th: "กระดูกสะบ้าหัวเข่า",
    en: "Patella (Kneecap)",
    la: "Patella",
    fma: "FMA:24485",
    snomed: "64234005",
    system: "Skeletal (Lower limb)",
    desc: "กระดูก Sesamoid bone ที่ใหญ่ที่สุด ฝังตัวอยู่ในเอ็น Quadriceps tendon ช่วยเพิ่มแรงงัดในการเหยียดเข่า",
    clinical: "การเคลื่อนหลุดของกระดูกสะบ้า (Patellar dislocation) หรือผิวข้อเสื่อม Chondromalacia patellae"
  },
  "Tibia & Fibula": {
    th: "กระดูกหน้าแข้งและน่อง",
    en: "Tibia & Fibula (Leg bones)",
    la: "Crus (Tibia et Fibula)",
    fma: "FMA:9613",
    snomed: "287579007",
    system: "Skeletal (Lower limb)",
    desc: "Tibia รับน้ำหนักหลักของร่างกาย Fibula เป็นจุดเกาะกล้ามเนื้อและสร้างข้อเท้าตาตุ่มนอก",
    clinical: "Tibial shaft fracture เป็นกระดูกยาวที่หักทะลุผิวหนัง (Open fracture) บ่อยที่สุด และเสี่ยงต่อ Compartment syndrome"
  }
};
