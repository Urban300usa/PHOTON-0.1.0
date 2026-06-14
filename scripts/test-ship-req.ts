import "dotenv/config";

const ESI_BASE_URL = "https://esi.evetech.net/latest";

// Ishtar type ID is 12005
const ISHTAR_TYPE_ID = 12005;

async function testShipRequirements() {
  console.log("Testing ship requirements for Ishtar (type_id: 12005)...\n");

  // Fetch ship type info from ESI
  const typeRes = await fetch(
    `${ESI_BASE_URL}/universe/types/${ISHTAR_TYPE_ID}/?datasource=tranquility`
  );

  if (!typeRes.ok) {
    console.error("Failed to fetch ship type");
    return;
  }

  const typeData = await typeRes.json();
  console.log(`Ship: ${typeData.name}`);
  console.log(`Group ID: ${typeData.group_id}`);

  const dogmaAttrs = typeData.dogma_attributes || [];

  // Helper function to extract skill requirements
  const extractSkillRequirements = (attrs: any[]): { skillId: number; requiredLevel: number }[] => {
    const attrMap = new Map(attrs.map((a: any) => [a.attribute_id, a.value]));
    const requirements: { skillId: number; requiredLevel: number }[] = [];

    const skillAttrIds = [182, 183, 184, 185, 186];
    const levelAttrIds = [277, 278, 279, 280, 281];

    for (let i = 0; i < 5; i++) {
      const skillId = attrMap.get(skillAttrIds[i]);
      const level = attrMap.get(levelAttrIds[i]);
      if (skillId && level && skillId > 0) {
        requirements.push({ skillId: Math.floor(skillId), requiredLevel: Math.floor(level) });
      }
    }
    return requirements;
  };

  // Recursively fetch all skill prerequisites
  const allRequirements: Map<number, { skillId: number; skillName: string; requiredLevel: number; isPrerequisite: boolean }> = new Map();
  const processedSkills = new Set<number>();

  const fetchSkillPrerequisites = async (skillId: number, requiredLevel: number, isPrereq: boolean): Promise<void> => {
    const existing = allRequirements.get(skillId);
    if (existing && existing.requiredLevel >= requiredLevel) {
      return;
    }

    const skillRes = await fetch(
      `${ESI_BASE_URL}/universe/types/${skillId}/?datasource=tranquility`
    );

    if (!skillRes.ok) {
      console.log(`Failed to fetch skill ${skillId}`);
      return;
    }

    const skillData = await skillRes.json();

    allRequirements.set(skillId, {
      skillId,
      skillName: skillData.name,
      requiredLevel,
      isPrerequisite: isPrereq,
    });

    if (processedSkills.has(skillId)) return;
    processedSkills.add(skillId);

    const skillDogma = skillData.dogma_attributes || [];
    const prereqs = extractSkillRequirements(skillDogma);

    for (const prereq of prereqs) {
      await fetchSkillPrerequisites(prereq.skillId, prereq.requiredLevel, true);
    }
  };

  // Extract direct ship requirements
  const directReqs = extractSkillRequirements(dogmaAttrs);
  console.log(`\nDirect requirements: ${directReqs.length}`);

  // Fetch all requirements including prerequisites
  for (const req of directReqs) {
    await fetchSkillPrerequisites(req.skillId, req.requiredLevel, false);
  }

  const requirements = Array.from(allRequirements.values());

  console.log(`\nTotal requirements (including prerequisites): ${requirements.length}\n`);

  // Sort: direct requirements first, then prerequisites
  requirements.sort((a, b) => {
    if (a.isPrerequisite !== b.isPrerequisite) {
      return a.isPrerequisite ? 1 : -1;
    }
    return a.skillName.localeCompare(b.skillName);
  });

  console.log("=== DIRECT REQUIREMENTS ===");
  requirements.filter(r => !r.isPrerequisite).forEach(req => {
    console.log(`  ${req.skillName} ${req.requiredLevel}`);
  });

  console.log("\n=== PREREQUISITES ===");
  requirements.filter(r => r.isPrerequisite).forEach(req => {
    console.log(`  ${req.skillName} ${req.requiredLevel}`);
  });
}

testShipRequirements().catch(console.error);
