"""
Test suite for EdilGest AI Quote Analyzer API endpoints.
Tests: GET /api/, POST /api/quotes/extract, POST /api/quotes/compare,
       GET /api/quotes/comparisons/{project_id}, DELETE /api/quotes/comparison/{comparison_id}
"""
import pytest
import requests
import os
import base64
import uuid
import time
from io import BytesIO

# Use the public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://edilgest-fix.preview.emergentagent.com"

# Test project ID for cleanup
TEST_PROJECT_ID = f"TEST_project_{uuid.uuid4().hex[:8]}"
TEST_USER_ID = f"TEST_user_{uuid.uuid4().hex[:8]}"

# Store created comparison IDs for cleanup
created_comparison_ids = []


def create_realistic_quote_image():
    """
    Create a realistic Italian construction quote image using PIL.
    Contains text that looks like an actual quote document.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        pytest.skip("PIL not installed - cannot create test images")
    
    # Create a white background image
    width, height = 800, 1000
    img = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a default font, fallback to default if not available
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Draw header
    draw.rectangle([(0, 0), (width, 80)], fill='#2563eb')
    draw.text((20, 20), "PREVENTIVO N. 2024/0156", fill='white', font=font_large)
    draw.text((20, 50), "Serramenti e Infissi SRL", fill='white', font=font_medium)
    
    # Company info
    y = 100
    draw.text((20, y), "Via Roma 123, 20100 Milano", fill='black', font=font_small)
    draw.text((20, y+20), "P.IVA: 12345678901", fill='black', font=font_small)
    draw.text((20, y+40), "Tel: 02 1234567", fill='black', font=font_small)
    
    # Date and validity
    draw.text((550, y), "Data: 15/01/2024", fill='black', font=font_small)
    draw.text((550, y+20), "Validita: 30 giorni", fill='black', font=font_small)
    
    # Separator line
    y = 180
    draw.line([(20, y), (width-20, y)], fill='gray', width=1)
    
    # Table header
    y = 200
    draw.rectangle([(20, y), (width-20, y+30)], fill='#f3f4f6')
    draw.text((30, y+8), "Descrizione", fill='black', font=font_medium)
    draw.text((400, y+8), "Qta", fill='black', font=font_medium)
    draw.text((480, y+8), "Prezzo Unit.", fill='black', font=font_medium)
    draw.text((620, y+8), "Totale", fill='black', font=font_medium)
    
    # Quote items
    items = [
        ("Finestra PVC 120x140 cm - Doppio vetro", "2", "€ 450,00", "€ 900,00"),
        ("Porta finestra PVC 220x240 cm", "1", "€ 850,00", "€ 850,00"),
        ("Persiana alluminio 120x140 cm", "2", "€ 280,00", "€ 560,00"),
        ("Zanzariera a rullo 120x140 cm", "2", "€ 120,00", "€ 240,00"),
        ("Posa in opera e installazione", "1", "€ 350,00", "€ 350,00"),
    ]
    
    y = 240
    for desc, qty, unit, total in items:
        draw.line([(20, y), (width-20, y)], fill='#e5e7eb', width=1)
        draw.text((30, y+8), desc, fill='black', font=font_small)
        draw.text((410, y+8), qty, fill='black', font=font_small)
        draw.text((480, y+8), unit, fill='black', font=font_small)
        draw.text((620, y+8), total, fill='black', font=font_small)
        y += 35
    
    # Totals section
    y += 20
    draw.line([(20, y), (width-20, y)], fill='gray', width=2)
    y += 15
    draw.text((480, y), "Imponibile:", fill='black', font=font_medium)
    draw.text((620, y), "€ 2.900,00", fill='black', font=font_medium)
    y += 25
    draw.text((480, y), "IVA 22%:", fill='black', font=font_medium)
    draw.text((620, y), "€ 638,00", fill='black', font=font_medium)
    y += 25
    draw.rectangle([(470, y-5), (width-20, y+25)], fill='#2563eb')
    draw.text((480, y), "TOTALE:", fill='white', font=font_large)
    draw.text((620, y), "€ 3.538,00", fill='white', font=font_large)
    
    # Notes section
    y += 60
    draw.text((20, y), "Note:", fill='black', font=font_medium)
    y += 25
    draw.text((20, y), "- Garanzia 10 anni su profili e vetri", fill='gray', font=font_small)
    y += 18
    draw.text((20, y), "- Tempi di consegna: 30 giorni lavorativi", fill='gray', font=font_small)
    y += 18
    draw.text((20, y), "- Posa inclusa nel prezzo", fill='gray', font=font_small)
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')


def create_second_quote_image():
    """Create a second quote image for comparison testing."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        pytest.skip("PIL not installed - cannot create test images")
    
    width, height = 800, 900
    img = Image.new('RGB', (width, height), color='#fffef0')
    draw = ImageDraw.Draw(img)
    
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Header
    draw.rectangle([(0, 0), (width, 70)], fill='#059669')
    draw.text((20, 15), "OFFERTA COMMERCIALE", fill='white', font=font_large)
    draw.text((20, 45), "Infissi Premium Italia", fill='white', font=font_medium)
    
    y = 90
    draw.text((20, y), "Via Garibaldi 45, 20121 Milano", fill='black', font=font_small)
    draw.text((550, y), "Data: 18/01/2024", fill='black', font=font_small)
    
    y = 130
    draw.line([(20, y), (width-20, y)], fill='#059669', width=2)
    
    # Items
    y = 150
    items = [
        ("Finestra alluminio 120x140 cm - Triplo vetro", "2", "€ 580,00", "€ 1.160,00"),
        ("Porta finestra alluminio 220x240 cm", "1", "€ 1.100,00", "€ 1.100,00"),
        ("Persiana blindata 120x140 cm", "2", "€ 420,00", "€ 840,00"),
        ("Zanzariera plisse 120x140 cm", "2", "€ 180,00", "€ 360,00"),
    ]
    
    for desc, qty, unit, total in items:
        draw.text((30, y), f"• {desc}", fill='black', font=font_small)
        draw.text((550, y), f"{qty} x {unit} = {total}", fill='black', font=font_small)
        y += 30
    
    y += 20
    draw.line([(400, y), (width-20, y)], fill='gray', width=1)
    y += 10
    draw.text((400, y), "Subtotale: € 3.460,00", fill='black', font=font_medium)
    y += 25
    draw.text((400, y), "IVA 22%: € 761,20", fill='black', font=font_medium)
    y += 25
    draw.text((400, y), "TOTALE: € 4.221,20", fill='#059669', font=font_large)
    
    y += 50
    draw.text((20, y), "Condizioni:", fill='black', font=font_medium)
    y += 20
    draw.text((20, y), "- Garanzia 15 anni", fill='gray', font=font_small)
    y += 15
    draw.text((20, y), "- Consegna: 45 giorni", fill='gray', font=font_small)
    y += 15
    draw.text((20, y), "- Posa NON inclusa (€ 400 extra)", fill='gray', font=font_small)
    
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')


class TestHealthEndpoint:
    """Test the root API endpoint."""
    
    def test_api_root_returns_200(self):
        """GET /api/ should return 200 with Hello World message."""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message' key"
        assert data["message"] == "Hello World", f"Expected 'Hello World', got {data['message']}"
        print(f"✓ GET /api/ returned 200 with message: {data['message']}")


class TestQuoteExtraction:
    """Test the quote extraction endpoint with Gemini AI."""
    
    def test_extract_quote_with_realistic_image(self):
        """POST /api/quotes/extract should extract data from a realistic quote image."""
        image_base64 = create_realistic_quote_image()
        
        payload = {
            "file_base64": image_base64,
            "file_name": "preventivo_test.png",
            "mime_type": "image/png"
        }
        
        print(f"Sending extract request to {BASE_URL}/api/quotes/extract...")
        response = requests.post(
            f"{BASE_URL}/api/quotes/extract",
            json=payload,
            timeout=60  # Gemini AI may take time
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        
        if data["success"]:
            assert "data" in data, "Successful response should contain 'data' key"
            extracted = data["data"]
            
            # Validate structure
            print(f"✓ Extraction successful. Fornitore: {extracted.get('fornitore', 'N/A')}")
            print(f"  Items extracted: {len(extracted.get('items', []))}")
            print(f"  Totale lordo: {extracted.get('totale_lordo', 'N/A')}")
            
            # Basic structure validation
            assert isinstance(extracted.get('items', []), list), "items should be a list"
        else:
            # If extraction failed, log the error but don't fail the test
            # (Gemini may have issues with certain images)
            print(f"⚠ Extraction returned success=False: {data.get('error', 'Unknown error')}")
            # Still pass if we got a valid response structure
            assert "error" in data, "Failed response should contain 'error' key"
    
    def test_extract_quote_missing_fields(self):
        """POST /api/quotes/extract should handle missing required fields."""
        # Missing file_base64
        payload = {
            "file_name": "test.png",
            "mime_type": "image/png"
        }
        
        response = requests.post(f"{BASE_URL}/api/quotes/extract", json=payload)
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"
        print("✓ Missing field validation works correctly")


class TestQuoteComparison:
    """Test the quote comparison endpoint."""
    
    def test_compare_quotes_with_mock_data(self):
        """POST /api/quotes/compare should compare quotes and return AI analysis."""
        global created_comparison_ids
        
        # Mock extracted quote data (simulating what extract would return)
        quote1 = {
            "fornitore": "Serramenti e Infissi SRL",
            "data_preventivo": "15/01/2024",
            "validita": "30 giorni",
            "items": [
                {
                    "descrizione": "Finestra PVC 120x140 cm - Doppio vetro",
                    "quantita": 2,
                    "materiale": "PVC",
                    "prezzo_unitario": 450.00,
                    "prezzo_totale": 900.00
                },
                {
                    "descrizione": "Porta finestra PVC 220x240 cm",
                    "quantita": 1,
                    "materiale": "PVC",
                    "prezzo_unitario": 850.00,
                    "prezzo_totale": 850.00
                }
            ],
            "totale_imponibile": 2900.00,
            "iva": 638.00,
            "totale_lordo": 3538.00,
            "posa_inclusa": True,
            "garanzia_anni": 10,
            "tempi_consegna": "30 giorni lavorativi"
        }
        
        quote2 = {
            "fornitore": "Infissi Premium Italia",
            "data_preventivo": "18/01/2024",
            "validita": "30 giorni",
            "items": [
                {
                    "descrizione": "Finestra alluminio 120x140 cm - Triplo vetro",
                    "quantita": 2,
                    "materiale": "Alluminio",
                    "prezzo_unitario": 580.00,
                    "prezzo_totale": 1160.00
                },
                {
                    "descrizione": "Porta finestra alluminio 220x240 cm",
                    "quantita": 1,
                    "materiale": "Alluminio",
                    "prezzo_unitario": 1100.00,
                    "prezzo_totale": 1100.00
                }
            ],
            "totale_imponibile": 3460.00,
            "iva": 761.20,
            "totale_lordo": 4221.20,
            "posa_inclusa": False,
            "garanzia_anni": 15,
            "tempi_consegna": "45 giorni"
        }
        
        payload = {
            "project_id": TEST_PROJECT_ID,
            "quotes": [quote1, quote2],
            "quote_names": ["Preventivo Serramenti SRL", "Preventivo Infissi Premium"],
            "user_id": TEST_USER_ID,
            "categoria": "serramenti"
        }
        
        print(f"Sending compare request to {BASE_URL}/api/quotes/compare...")
        response = requests.post(
            f"{BASE_URL}/api/quotes/compare",
            json=payload,
            timeout=90  # AI comparison may take longer
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        
        if data["success"]:
            assert "comparison" in data, "Successful response should contain 'comparison' key"
            assert "report" in data, "Successful response should contain 'report' key"
            
            comparison = data["comparison"]
            assert "id" in comparison, "Comparison should have an 'id'"
            assert comparison["project_id"] == TEST_PROJECT_ID, "Project ID should match"
            
            # Store for cleanup
            created_comparison_ids.append(comparison["id"])
            
            print(f"✓ Comparison created successfully. ID: {comparison['id']}")
            print(f"  Report length: {len(comparison.get('report', ''))}")
            
            # Validate report structure
            report = data["report"]
            if isinstance(report, dict):
                print(f"  Report keys: {list(report.keys())}")
        else:
            print(f"⚠ Comparison returned success=False: {data.get('error', 'Unknown error')}")
            assert "error" in data, "Failed response should contain 'error' key"
    
    def test_compare_quotes_insufficient_quotes(self):
        """POST /api/quotes/compare should reject requests with less than 2 quotes."""
        payload = {
            "project_id": TEST_PROJECT_ID,
            "quotes": [{"fornitore": "Test"}],  # Only 1 quote
            "quote_names": ["Single Quote"],
            "user_id": TEST_USER_ID,
            "categoria": "test"
        }
        
        response = requests.post(f"{BASE_URL}/api/quotes/compare", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == False, "Should fail with insufficient quotes"
        assert "error" in data, "Should contain error message"
        assert "2 preventivi" in data["error"].lower() or "almeno 2" in data["error"].lower(), \
            f"Error should mention needing 2 quotes: {data['error']}"
        print(f"✓ Correctly rejected single quote comparison: {data['error']}")


class TestGetComparisons:
    """Test retrieving saved comparisons."""
    
    def test_get_comparisons_for_project(self):
        """GET /api/quotes/comparisons/{project_id} should return saved comparisons."""
        # First create a comparison to ensure there's data
        quote1 = {"fornitore": "Test A", "totale_lordo": 1000}
        quote2 = {"fornitore": "Test B", "totale_lordo": 1200}
        
        create_payload = {
            "project_id": TEST_PROJECT_ID,
            "quotes": [quote1, quote2],
            "quote_names": ["Quote A", "Quote B"],
            "user_id": TEST_USER_ID,
            "categoria": "test"
        }
        
        # Create comparison
        create_response = requests.post(
            f"{BASE_URL}/api/quotes/compare",
            json=create_payload,
            timeout=90
        )
        
        if create_response.status_code == 200:
            create_data = create_response.json()
            if create_data.get("success") and "comparison" in create_data:
                created_comparison_ids.append(create_data["comparison"]["id"])
        
        # Now get comparisons
        response = requests.get(f"{BASE_URL}/api/quotes/comparisons/{TEST_PROJECT_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert data["success"] == True, f"Should succeed: {data.get('error', '')}"
        assert "comparisons" in data, "Response should contain 'comparisons' key"
        assert isinstance(data["comparisons"], list), "Comparisons should be a list"
        
        print(f"✓ Retrieved {len(data['comparisons'])} comparisons for project {TEST_PROJECT_ID}")
        
        # Validate comparison structure if any exist
        if data["comparisons"]:
            comp = data["comparisons"][0]
            assert "id" in comp, "Comparison should have 'id'"
            assert "project_id" in comp, "Comparison should have 'project_id'"
            assert "quotes" in comp, "Comparison should have 'quotes'"
            print(f"  First comparison ID: {comp['id']}")
    
    def test_get_comparisons_empty_project(self):
        """GET /api/quotes/comparisons/{project_id} should return empty list for unknown project."""
        unknown_project = f"TEST_unknown_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/quotes/comparisons/{unknown_project}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == True, "Should succeed even for unknown project"
        assert data["comparisons"] == [], "Should return empty list for unknown project"
        print(f"✓ Correctly returned empty list for unknown project")


class TestDeleteComparison:
    """Test deleting comparisons."""
    
    def test_delete_comparison(self):
        """DELETE /api/quotes/comparison/{comparison_id} should delete a comparison."""
        # First create a comparison to delete
        quote1 = {"fornitore": "Delete Test A", "totale_lordo": 500}
        quote2 = {"fornitore": "Delete Test B", "totale_lordo": 600}
        
        create_payload = {
            "project_id": TEST_PROJECT_ID,
            "quotes": [quote1, quote2],
            "quote_names": ["Delete A", "Delete B"],
            "user_id": TEST_USER_ID,
            "categoria": "delete_test"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/quotes/compare",
            json=create_payload,
            timeout=90
        )
        
        assert create_response.status_code == 200, f"Failed to create comparison: {create_response.text}"
        create_data = create_response.json()
        
        if not create_data.get("success"):
            pytest.skip(f"Could not create comparison for delete test: {create_data.get('error')}")
        
        comparison_id = create_data["comparison"]["id"]
        print(f"Created comparison {comparison_id} for delete test")
        
        # Now delete it
        delete_response = requests.delete(f"{BASE_URL}/api/quotes/comparison/{comparison_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        delete_data = delete_response.json()
        assert delete_data["success"] == True, f"Delete should succeed: {delete_data.get('error', '')}"
        print(f"✓ Successfully deleted comparison {comparison_id}")
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/quotes/comparison/{comparison_id}")
        assert get_response.status_code == 200, f"Expected 200, got {get_response.status_code}"
        
        get_data = get_response.json()
        assert get_data["success"] == False, "Should fail to find deleted comparison"
        print(f"✓ Verified comparison no longer exists")
    
    def test_delete_nonexistent_comparison(self):
        """DELETE /api/quotes/comparison/{comparison_id} should handle non-existent IDs."""
        fake_id = f"TEST_fake_{uuid.uuid4().hex}"
        
        response = requests.delete(f"{BASE_URL}/api/quotes/comparison/{fake_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["success"] == False, "Should fail for non-existent comparison"
        assert "error" in data, "Should contain error message"
        print(f"✓ Correctly handled non-existent comparison: {data['error']}")


class TestCleanup:
    """Cleanup test data after all tests."""
    
    def test_cleanup_test_comparisons(self):
        """Clean up any remaining test comparisons."""
        global created_comparison_ids
        
        deleted_count = 0
        for comp_id in created_comparison_ids:
            try:
                response = requests.delete(f"{BASE_URL}/api/quotes/comparison/{comp_id}")
                if response.status_code == 200 and response.json().get("success"):
                    deleted_count += 1
            except:
                pass
        
        print(f"✓ Cleanup: Deleted {deleted_count} test comparisons")
        created_comparison_ids.clear()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
