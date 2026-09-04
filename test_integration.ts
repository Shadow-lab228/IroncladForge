// Test script for Phase 7B integration 
import { ApplicationArchitect } from './engine/src/ApplicationArchitect.ts';

async function testArchitecture() {
    console.log("=== Testing Architecture Selection ===");
    
    const architect = new ApplicationArchitect();
    const request = "Create a modern website for Ironclad Systems, a software company. Include a professional homepage, services section, about section, contact section, responsive navigation, dark mode, animations, and polished professional design.";
    
    try {
        const blueprint = architect.analyze(request);
        console.log("✓ Architecture Analysis Successful");
        
        console.log("\n--- Selected Architecture ---");
        console.log(`Framework: ${blueprint.framework}`);
        console.log(`Type: ${blueprint.type}`);
        console.log(`Language: ${blueprint.language}`);
        console.log(`Package Manager: ${blueprint.packageManager}`);
        console.log(`Runtime: ${blueprint.runtime}`);
        console.log(`Entry Point: ${blueprint.entryPoint}`);
        
        if (blueprint.scripts && Object.keys(blueprint.scripts).length > 0) {
            console.log("\n--- Build Scripts ---");
            for (const [key, value] of Object.entries(blueprint.scripts)) {
                console.log(`${key}: ${value}`);
            }
        }
        
        if (blueprint.dependencies && Object.keys(blueprint.dependencies).length > 0) {
            console.log("\n--- Dependencies ---");
            for (const [key, value] of Object.entries(blueprint.dependencies)) {
                console.log(`${key}: ${value}`);
            }
        }
    } catch (error) {
        console.error("✗ Architecture Analysis Failed:", error);
        return false;
    }
    
    return true;
}

testArchitecture().then(success => {
    if (success) {
        console.log("\n=== Architecture Test PASSED ===");
    } else {
        console.log("\n=== Architecture Test FAILED ===");
    }
});