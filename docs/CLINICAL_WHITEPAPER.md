# AnatoPhysio AR: เอกสารวิชาการทางการแพทย์และคู่มือระบบเสมือนจริง
## (Clinical & Educational Whitepaper: Real-time Medical Anatomy, Physiology & Biomechanics)

**ผู้จัดทำ:** มหาวิทยาลัยราชภัฏรำไพพรรณี ร่วมกับ คณะทำงานพัฒนาเทคโนโลยีสุขภาพและชีวการแพทย์ดิจิทัล  
**เวอร์ชันระบบ:** 4.0 (Full Clinical Architecture)  
**คลังซอฟต์แวร์:** [https://github.com/TsanaPhysics/anatophysio-ar](https://github.com/TsanaPhysics/anatophysio-ar)  
**URL ปฏิบัติการ (Local):** [http://localhost/anatophysio-ar/](http://localhost/anatophysio-ar/)

---

### บทคัดย่อ (Executive Summary)

**AnatoPhysio AR** เป็นนวัตกรรมกระจกส่องตรวจเสมือนจริง (Interactive Clinical Augmented Reality Mirror) ที่ผสาน **คอมพิวเตอร์วิทัศน์ปัญญาประดิษฐ์ (MediaPipe AI Vision)**, **การประมวลผลกราฟิก 3 มิติประสิทธิภาพสูง (WebGL / Three.js)**, และ **แบบจำลองทางสรีรวิทยาและชีวกลศาสตร์ (Physiological & Biomechanical Modeling)** เข้าไว้ด้วยกันในแพลตฟอร์ม Web-based ที่ทำงานบนเบราว์เซอร์ได้ทันทีโดยไม่ต้องติดตั้งปลั๊กอินเพิ่มเติม

ระบบสามารถตรวจจับและวิเคราะห์ตำแหน่งกายวิภาคของผู้ใช้งานผ่านกล้องเว็บแคมทั่วไปพร้อมกัน 3 มิติ:
1. **Craniomaxillofacial & Neuroanatomy:** กะโหลกศีรษะ สมอง 4 กลีบ กล้ามเนื้อใบหน้า และข้อต่อขากรรไกร (TMJ)
2. **Cardiorespiratory Physiology & Contactless Biosensing:** ระบบจำลองวงจรหัวใจ Carl Wiggers ครบ 7 เฟส พร้อมการสกัดสัญญาณชีพจรจริงจากสีผิวหน้าผากผ่านเทคนิค Remote Photoplethysmography (rPPG) และแสดงคลื่นไฟฟ้าหัวใจ Lead II ECG Oscilloscope
3. **Full-Body Kinematics & Spine Biomechanics:** โครงกระดูกทั้งตัวที่เคลื่อนไหวตาม 33 Pose Keypoints แบบ Articulated Kinematics พร้อมเครื่องมือตรวจวัดมุมทางคลินิก (Cobb Angle สำหรับประเมินกระดูกสันหลังคด และ CROM สำหรับช่วงการเคลื่อนไหวกระดูกคอ)

---

### 1. แบบจำลองสรีรวิทยาและชีวกลศาสตร์ (Physiological & Mathematical Foundations)

```
                       ┌──────────────────────────────────────┐
                       │     MediaPipe AI Vision Pipeline     │
                       └──────────────────┬───────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│  FaceLandmarker  │             │  HandLandmarker  │             │  PoseLandmarker  │
│    (468 จุด)     │             │    (21 x 2 จุด)  │             │    (33 จุด)      │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         ▼                                ▼                                ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│ • rPPG Face Pulse│             │ • Finger Joints  │             │ • Torso Matrix   │
│ • TMJ Distance   │             │   Carpals/Phal.  │             │ • Articulated IK │
│ • Cervical CROM  │             │ • X-Ray Lens Tool│             │ • Cobb Angle     │
└────────┬─────────┘             └────────┬─────────┘             └────────┬─────────┘
         │                                │                                │
         └────────────────────────────────┼────────────────────────────────┘
                                          ▼
                       ┌──────────────────────────────────────┐
                       │       AnatoPhysio Core Engine        │
                       │  - Wiggers Cycle & ECG Lead II       │
                       │  - S1/S2 Acoustic Valve Synthesizer  │
                       │  - Custom Depth-Aware GLSL Shaders   │
                       └──────────────────┬───────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │  Clinical HUD & Interactive 3D AR    │
                       └──────────────────────────────────────┘
```

#### 1.1 การสกัดสัญญาณชีพไร้สัมผัส (Remote Photoplethysmography - rPPG)
การเต้นของหัวใจทำให้เกิดการเปลี่ยนแปลงของปริมาตรเม็ดเลือดแดงในเส้นเลือดฝอยใต้ผิวหนัง (Capillary blood volume pulsation) เม็ดเลือดแดงที่มี Hemoglobin จะดูดกลืนคลื่นแสงสีเขียว ($\lambda \approx 520 - 580\text{ nm}$) ได้ดีกว่าแสงสีแดง

เมื่อคำนวณอัตราส่วนค่าความเข้มสีเฉลี่ยบนพื้นที่หน้าผาก (Forehead ROI):
$$S(t) = \frac{\bar{G}(t)}{\bar{R}(t)}$$
สัญญาณที่ได้จะผ่านกระบวนการ Zero-mean Detrending และผ่านตัวกรองแถบความถี่ (Bandpass Filter) ในช่วงความถี่สรีรวิทยาของมนุษย์ $0.75\text{ Hz} \le f \le 3.0\text{ Hz}$ (เทียบเท่า $45 - 180\text{ BPM}$) อัตราหัวใจเต้น (Heart Rate) คำนวณจากค่าความล่าช้าสูงสุดของฟังก์ชันความสัมพันธ์ในตัวเอง (Autocorrelation Peak Lag $\tau^*$):
$$\text{BPM} = \frac{f_s}{\tau^*} \times 60$$

#### 1.2 วงจรหัวใจตามสรีรวิทยาของ Carl Wiggers (Wiggers Cardiac Cycle)
ระบบจำลองวงจรการทำงานของหัวใจสัมพันธ์กับคลื่นไฟฟ้าหัวใจ (Lead II ECG) โดยแบ่งวัฏจักรออกเป็น 7 เฟส:
1. **Atrial Systole ($\phi = 0.00 - 0.16$):** คลื่น P wave เกิดขึ้น Atria บีบตัวเติมเลือดห้องล่างสู่ End-Diastolic Volume (EDV)
2. **Isovolumetric Contraction ($\phi = 0.16 - 0.22$):** คลื่น QRS complex เกิดขึ้น ความดันในห้องล่างสูงขึ้นฉับพลัน ลิ้นหัวใจ Mitral และ Tricuspid ปิดสนิท ทำให้เกิดเสียงหัวใจที่หนึ่ง **S1 ("Lub")**
3. **Rapid Ventricular Ejection ($\phi = 0.22 - 0.38$):** ลิ้น Aortic และ Pulmonic เปิด เลือดถูกฉีดเข้าสู่หลอดเลือดใหญ่ ยอดหัวใจ (Apex) บิดเกลียวแบบทวนเข็มนาฬิกา (Helical apex twist สูงสุด $0.26\text{ rad}$)
4. **Reduced Ventricular Ejection ($\phi = 0.38 - 0.50$):** คลื่น T wave เกิดขึ้น การฉีดเลือดเริ่มชะลอตัวลง
5. **Isovolumetric Relaxation ($\phi = 0.50 - 0.58$):** ลิ้น Aortic และ Pulmonic ปิดสนิท ทำให้เกิดเสียงหัวใจที่สอง **S2 ("Dub")** และเกิดคลื่นสะท้อน Dicrotic Notch บนท่อหลอดเลือด Aorta การคลายเกลียวอย่างรวดเร็วทำให้เกิดแรงดูด Suction ในห้องล่าง
6. **Rapid Ventricular Inflow ($\phi = 0.58 - 0.75$):** เลือดไหลเข้าห้องล่างอย่างรวดเร็ว
7. **Diastasis ($\phi = 0.75 - 1.00$):** ระยะพักคลายตัวเต็มที่ก่อนเริ่มวงจรถัดไป

#### 1.3 แบบจำลองภาระกดทับกระดูกคอ C1-C7 (Kapandji Cervical Load Formulation)
ศีรษะมนุษย์ในแนวดิ่งมีน้ำหนักเฉลี่ย $5.0\text{ kg}$ เมื่อเกิดการก้มคอไปข้างหน้า (Forward Head Flexion Angle $\theta$) ภาระกดทับจำลองตามแบบจำลองชีวกลศาสตร์กระดูกคอของ Adalbert Kapandji:
$$L(\theta) = 5.0 + 0.50\theta - 0.0022\theta^2 \quad (\text{kg}), \quad \text{for } 0^\circ \le \theta \le 60^\circ$$
* ที่มุมก้ม $15^\circ$: ภาระเพิ่มเป็น $\approx 12\text{ kg}$
* ที่มุมก้ม $30^\circ$: ภาระเพิ่มเป็น $\approx 18\text{ kg}$
* ที่มุมก้ม $60^\circ$: ภาระเพิ่มเป็น $\approx 27\text{ kg}$ (เสี่ยงต่อภาวะ Text-Neck Syndrome และหมอนรองกระดูกคอเสื่อม)

#### 1.4 การตรวจวัดมุมกระดูกสันหลังคด (Cobb Angle Measurement)
ประเมินความเอียงในระนาบ Coronal Plane โดยหาเวกเตอร์แนวแกนระหว่างจุดกึ่งกลางไหล่ ($T_1$) และจุดกึ่งกลางสะโพก ($L_5$):
$$\theta_{\text{Cobb}} = \arctan\left(\frac{|\Delta X|}{|\Delta Y|}\right) \times 1.85 \times \frac{180^\circ}{\pi}$$
* เกณฑ์ปกติ: $\theta < 10^\circ$
* สันหลังคดระดับเริ่มต้น (Mild Scoliosis): $10^\circ \le \theta < 25^\circ$
* สันหลังคดระดับปานกลาง/รุนแรง (Moderate/Severe): $\theta \ge 25^\circ$

---

### 2. มาตรฐานคลังคำศัพท์กายวิภาคศาสตร์สากล (Medical Ontologies)

คลังคำศัพท์ของระบบใน [`src/anatomy/dictionary.js`](file:///Applications/XAMPP/xamppfiles/htdocs/x-ray/src/anatomy/dictionary.js) ได้รับการกำกับด้วยรหัสมาตรฐานสากล:
* **FMA (Foundational Model of Anatomy):** พัฒนาโดยมหาวิทยาลัยวอชิงตัน เป็นมาตรฐานกายวิภาคศาสตร์โครงสร้างเชิงคอมพิวเตอร์ที่แม่นยำที่สุด
* **SNOMED CT (Systematized Nomenclature of Medicine - Clinical Terms):** มาตรฐานคำศัพท์คลินิกระดับโลกสำหรับเวชระเบียนอิเล็กทรอนิกส์
* **Nomina Anatomica (Latin):** ภาษาละตินทางการแพทย์สำหรับการสื่อสารทางกายวิภาคศาสตร์สากล

#### ตารางตัวอย่างโครงสร้างกายวิภาคศาสตร์ในระบบ:

| โครงสร้าง (TH) | English (EN) | Nomina Anatomica (LA) | รหัส FMA | SNOMED CT | ความสำคัญทางคลินิก |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **หัวใจ 4 ห้อง** | 4-Chamber Heart | *Cor* | `FMA:7088` | `80891009` | การสูบฉีดเลือด, Ejection Fraction, กล้ามเนื้อหัวใจขาดเลือด (MI) |
| **กระดูกหน้าผาก** | Frontal bone | *Os frontale* | `FMA:52734` | `87877006` | ปกป้องสมองกลีบหน้า, โพรงไซนัสหน้าผากอักเสบ, กระดูกหักยุบ |
| **ปอดขวา (3 พู)** | Right Lung | *Pulmo dexter* | `FMA:7339` | `39607008` | ปอด 3 กลีบ, ทางเดินสิ่งแปลกปลอมสำลัก (Right main bronchus) |
| **กระดูกต้นแขน** | Humerus | *Humerus* | `FMA:13303` | `85050009` | จุดเกาะกล้ามเนื้อ Deltoid, Midshaft fracture เสี่ยง Radial nerve palsy |
| **กระดูกต้นขา** | Femur | *Femur* | `FMA:9611` | `71341001` | กระดูกที่ยาวและแข็งแรงที่สุด, Femoral neck fracture เสี่ยง AVN |
| **กระดูกสันหลังอก**| Thoracic spine | *Vertebrae thoracicae*| `FMA:9139` | `122495006` | จุดเชื่อมต่อซี่โครง T1-T12, การประเมินกระดูกสันหลังคด (Scoliosis) |

---

### 3. แนวทางการนำไปประยุกต์ใช้ในการเรียนการสอน (Curriculum Integration)

#### 3.1 หลักสูตรแพทยศาสตร์และพยาบาลศาสตร์
* **วิชากายวิภาคศาสตร์มนุษย์ (Gross Anatomy):** ใช้เป็นสื่อการสอนเสมือนจริงก่อนเข้าห้องกรอส (Pre-dissection Lab) ให้ผู้เรียนเห็นภาพตำแหน่งอวัยวะภายในและโครงกระดูกซ้อนทับบนร่างกายมนุษย์ที่มีชีวิตจริง
* **วิชาสรีรวิทยาการแพทย์ (Medical Physiology):** เรียนรู้วงจร Wiggers Cycle, การเปลี่ยนแปลงของความดันและปริมาตรในหัวใจ, และฟังเสียงลิ้นหัวใจ S1/S2 สอดคล้องกับคลื่นไฟฟ้าหัวใจจริง

#### 3.2 หลักสูตรกายภาพบำบัดและวิทยาศาสตร์การกีฬา
* **วิชาชีวกลศาสตร์ (Biomechanics & Kinesiology):** ใช้วัดมุม Range of Motion (ROM) ของข้อต่อคอ ไหล่ ข้อศอก และข้อเข่าแบบเรียลไทม์
* **วิชาการยศาสตร์ (Ergonomics):** ใช้คัดกรองพฤติกรรมการก้มคอทำงานหน้าคอมพิวเตอร์และมือถือ เพื่อป้องกันโรค Text-Neck Syndrome และ Office Syndrome

---

### 4. สรุปคุณลักษณะทางเทคนิคและสถาปัตยกรรม (Technical Specifications)

* **Client Engine:** Pure HTML5, Modern ES Modules (Zero-dependency bundler), CSS3 Glassmorphism
* **3D Graphics Engine:** Three.js r160, Custom GLSL Dual-Mode Shaders (Solid PBR & Additive X-Ray Fluoroscopy with Depth Clipping)
* **AI Computer Vision:** Google MediaPipe Tasks Vision (`FaceLandmarker`, `HandLandmarker`, `PoseLandmarker`)
* **Audio Synthesizer:** Web Audio API (60-80 Hz sine/exponential envelopes for Lub-Dub heart tones, 440-587 Hz chimes)
* **Performance:** 60 FPS บนคอมพิวเตอร์และแล็ปท็อปทั่วไป (Zero-GC Loop design)

