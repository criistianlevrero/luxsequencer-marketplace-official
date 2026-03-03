/**
 * Vertex shader for concentric rings with instancing
 * Per-instance attributes: size, rotation, color
 */
export const vertexShader = `#version 300 es
  precision highp float;

  in vec2 position;
  in float instanceSize;
  in float instanceRotation;
  in float instanceStrokeWidth;
  in vec3 instanceColor;
  in float ringBand;
  
  out vec3 vColor;

  uniform mat4 projection;

  void main() {
    vColor = instanceColor;
    
    float effectiveSize = max(0.0, instanceSize - (ringBand * instanceStrokeWidth));
    vec2 scaledPos = position * effectiveSize;
    
    // Apply per-instance rotation
    float cos_r = cos(instanceRotation);
    float sin_r = sin(instanceRotation);
    vec2 rotatedPos = vec2(
      scaledPos.x * cos_r - scaledPos.y * sin_r,
      scaledPos.x * sin_r + scaledPos.y * cos_r
    );
    
    gl_Position = projection * vec4(rotatedPos, 0.0, 1.0);
  }
`;

/**
 * Fragment shader for concentric rings
 * Simple solid color (will be extended with gradients later)
 */
export const fragmentShader = `#version 300 es
  precision highp float;

  in vec3 vColor;
  out vec4 outColor;

  void main() {
    outColor = vec4(vColor, 1.0);
  }
`;

/**
 * Create and compile shader program
 */
export function createShaderProgram(gl: WebGL2RenderingContext, vertSource: string, fragSource: string): WebGLProgram | null {
  const vertShader = gl.createShader(gl.VERTEX_SHADER);
  if (!vertShader) return null;
  gl.shaderSource(vertShader, vertSource);
  gl.compileShader(vertShader);

  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertShader));
    return null;
  }

  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!fragShader) return null;
  gl.shaderSource(fragShader, fragSource);
  gl.compileShader(fragShader);

  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragShader));
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Shader program link error:', gl.getProgramInfoLog(program));
    return null;
  }

  gl.deleteShader(vertShader);
  gl.deleteShader(fragShader);

  return program;
}

/**
 * Generate vertices for a regular polygon (triangle fan)
 * Returns an array of { x, y } vertices
 */
export function generatePolygonVertices(sides: number, radius: number): Array<{ x: number; y: number }> {
  const vertices: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }]; // Center vertex
  const angleStep = (Math.PI * 2) / sides;
  const angleOffset = Math.PI / sides; // Rotate so flat side is at top

  for (let i = 0; i <= sides; i++) {
    const angle = angleStep * i + angleOffset;
    vertices.push({
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    });
  }

  return vertices;
}
