from app.services.image_storage import LocalImageStorage


def test_local_image_storage_round_trip(tmp_path):
    storage = LocalImageStorage(str(tmp_path))
    key = "workspaces/one/items/two.webp"

    storage.put(key, b"image-data", "image/webp")

    stored = storage.get(key)
    assert stored is not None
    assert stored.content == b"image-data"
    assert stored.content_type == "image/webp"

    storage.delete(key)
    assert storage.get(key) is None


def test_local_image_storage_rejects_path_traversal(tmp_path):
    storage = LocalImageStorage(str(tmp_path))

    try:
        storage.put("../outside.jpg", b"image-data", "image/jpeg")
    except ValueError as error:
        assert str(error) == "Invalid image storage key"
    else:
        raise AssertionError("Path traversal should be rejected")
