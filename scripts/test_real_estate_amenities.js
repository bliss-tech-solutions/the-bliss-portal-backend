const BASE_URL = 'http://localhost:3000/api';

async function testRealEstateAmenities() {
    console.log('🚀 Starting Real Estate Amenities Verification...\n');

    let projectId = null;

    try {
        // 1. Create Project with Amenities
        console.log('--- 1. Testing Create Project with Amenities ---');
        const newProject = {
            projectName: "Luxury Villas with Amenities",
            projectLocation: "Palm Jumeirah",
            groupSize: 5,
            amenities: [
                { name: "Swimming Pool", icon: "pool-icon-url" },
                { name: "Gym", icon: "gym-icon-url" }
            ]
        };

        const createRes = await fetch(`${BASE_URL}/realEstate/project/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProject)
        });
        const createData = await createRes.json();

        if (createData.success) {
            console.log('✅ Project Created Successfully:', createData.data._id);
            console.log('   Amenities:', createData.data.amenities);
            projectId = createData.data._id;
        } else {
            throw new Error(`Failed to create project: ${createData.message}`);
        }
        console.log('\n');

        // 2. Get Project by ID to verify persistence
        console.log('--- 2. Testing Get Project by ID ---');
        const getRes = await fetch(`${BASE_URL}/realEstate/project/getById/${projectId}`);
        const getData = await getRes.json();

        if (getData.success && getData.data.amenities.length === 2) {
            console.log('✅ Amenities Persisted Successfully:', getData.data.amenities);
        } else {
            throw new Error('Failed to retrieve project or amenities mismatch.');
        }
        console.log('\n');

        // 3. Update Project (Add new amenity)
        console.log('--- 3. Testing Update Project (Add Amenity) ---');
        const updatedAmenities = [
            ...getData.data.amenities,
            { name: "Private Beach", icon: "beach-icon-url" }
        ];

        const updateRes = await fetch(`${BASE_URL}/realEstate/project/update/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amenities: updatedAmenities })
        });
        const updateData = await updateRes.json();

        if (updateData.success && updateData.data.amenities.length === 3) {
            console.log('✅ Project Updated Successfully. New Amenities Count:', updateData.data.amenities.length);
        } else {
            throw new Error(`Failed to update project: ${updateData.message}`);
        }
        console.log('\n');

        // 4. Delete Project (Cleanup)
        console.log('--- 4. Cleaning Up (Delete Project) ---');
        const deleteRes = await fetch(`${BASE_URL}/realEstate/project/delete/${projectId}`, {
            method: 'DELETE'
        });
        const deleteData = await deleteRes.json();

        if (deleteData.success) {
            console.log('✅ Project Deleted Successfully');
        } else {
            console.warn('⚠️ Failed to delete project during cleanup');
        }

    } catch (error) {
        console.error('❌ Verification Failed:', error.message);
    }
}

testRealEstateAmenities();
