#!/usr/bin/env python3
"""src/ 를 하나의 HTML 파일(마지막 출석)로 합친다."""
import os
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, 'src')
r = lambda f: open(os.path.join(src, f), encoding='utf-8').read()
EX = ['CopyShader.js','LuminosityHighPassShader.js','FXAAShader.js','EffectComposer.js','RenderPass.js','ShaderPass.js','UnrealBloomPass.js','Sky.js','BufferGeometryUtils.js','RoundedBoxGeometry.js']
exjs = chr(10).join(r('vendor/ex/' + f) for f in EX)
js = ['data.js', 'env.js', 'render.js', 'world.js', 'models.js', 'core.js', 'story.js', 'ui.js', 'net.js', 'main.js']
html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>마지막 출석</title>
<style>
{r('style.css')}
</style>
</head>
<body>
{r('body.html')}
<script>{r('vendor/three.min.js')}</script>
<script>{r('vendor/peerjs.min.js')}</script>
<script>{exjs}</script>
<script>
{chr(10).join(r(f) for f in js)}
</script>
</body>
</html>
'''
out = os.path.join(here, '..', 'last-attendance.html')
open(out, 'w', encoding='utf-8').write(html)
print('built', os.path.normpath(out), len(html) // 1024, 'KB')
# Claude 링크(아티팩트)용: 문서 골격 없이 내용만
art = f'''<title>마지막 출석</title>
<style>
{r('style.css')}
</style>
{r('body.html')}
<script>{r('vendor/three.min.js')}</script>
<script>{r('vendor/peerjs.min.js')}</script>
<script>{exjs}</script>
<script>
{chr(10).join(r(f) for f in js)}
</script>
'''
open(os.path.join(here, 'dist-artifact.html'), 'w', encoding='utf-8').write(art)
