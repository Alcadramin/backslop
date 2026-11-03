from unittest.mock import MagicMock  # expect: mocked-unit-under-test


def render_canvas(spec):
    canvas = MagicMock()
    canvas.render.return_value = PRE_RENDERED
    return canvas.render(spec)
